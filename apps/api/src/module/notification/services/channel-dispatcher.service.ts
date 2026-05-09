import { Injectable, Logger } from '@nestjs/common';
import type { Notification, NotificationStatus } from '../domain/notification.schema';
import { NotificationRepository } from '../repositories/notification.repository';
import { NotificationDeliveryLogRepository } from '../repositories/notification-delivery-log.repository';
import { InAppChannelService } from '../channels/in-app/in-app.channel.service';
import { EmailChannelService } from '../channels/email/email.channel.service';
import { PushChannelService } from '../channels/push/push.channel.service';
import { UserPresenceService } from './user-presence.service';
import type {
  INotificationChannel,
  DeliveryContext,
  DeliveryResult,
} from '../channels/channel.interface';
import type { NotificationChannel } from '../domain/notification.schema';

// ---------------------------------------------------------------------------
// ChannelDispatcherService
//
// Single point of dispatch for all delivery channels.
//
// Responsibilities:
//  1. Route each notification to the correct channel adapter.
//  2. Absorb any exceptions thrown by the adapter (must never propagate).
//  3. Record a delivery attempt row in notification_delivery_logs.
//  4. Update the notification's status (sent | failed) and tracking fields
//     (deliveryAttempts, lastAttemptAt, sentAt).
//
// Architecture decisions:
//  - Adapter map is built at construction time — new channels are added by
//    registering a new INotificationChannel in the module, no if/else required.
//  - dispatch() is always called as a fire-and-forget (void) from
//    NotificationService — it MUST NOT throw.
//  - Delivery log write failure is logged but does not affect status update.
//  - Status update failure is logged but does not bubble up.
//  - Both failures are observable via structured logs.
//
// Retry strategy (Phase N-6):
//  Failed notifications can be retried by a background worker that queries
//   WHERE status = 'failed' AND next_retry_at < NOW() AND delivery_attempts < MAX.
//  This class records delivery_attempts and last_attempt_at but does NOT
//  schedule retries — that is deferred to Phase N-6 to keep this phase
//  focused on synchronous first-attempt delivery.
//
// Push suppression (Phase N-5 fix):
//  Before dispatching a push notification, ChannelDispatcherService checks
//  whether the recipient has at least one active WebSocket connection
//  (UserPresenceService.isOnline()). If the user is online, push delivery is
//  suppressed: the notification is marked 'sent' (it was delivered via the
//  in_app WebSocket channel) and a delivery log entry is written with
//  errorCode PUSH_SUPPRESSED_USER_ONLINE so the suppression is observable.
//
//  Delivery rules:
//   Rule 1 — Online:  persist (in_app + push rows) → deliver in_app WS → suppress push
//   Rule 2 — Offline: persist (in_app + push rows) → deliver in_app to inbox → deliver push
//   Rule 3 — Multiple WS connections: ANY active WS connection suppresses push
//   Rule 4 — Persistence always happens upstream (NotificationService) regardless of rules
//
// Phase: N-5 — Delivery Orchestration Fix
// ---------------------------------------------------------------------------

@Injectable()
export class ChannelDispatcherService {
  private readonly logger = new Logger(ChannelDispatcherService.name);

  /** Channel adapter registry. Key = NotificationChannel enum value. */
  private readonly adapterMap: Map<NotificationChannel, INotificationChannel>;

  constructor(
    private readonly inAppChannel: InAppChannelService,
    private readonly emailChannel: EmailChannelService,
    private readonly pushChannel: PushChannelService,
    private readonly notificationRepo: NotificationRepository,
    private readonly deliveryLogRepo: NotificationDeliveryLogRepository,
    private readonly presenceService: UserPresenceService,
  ) {
    this.adapterMap = new Map<NotificationChannel, INotificationChannel>([
      ['in_app', this.inAppChannel],
      ['email', this.emailChannel],
      ['push', this.pushChannel],
    ]);
  }

  /**
   * Dispatch a notification to its channel adapter.
   *
   * MUST NOT throw — all errors are absorbed internally.
   * Intended to be called as fire-and-forget:
   *   void this.channelDispatcher.dispatch(notification, context);
   *
   * @param notification The persisted notification row.
   * @param context      Delivery context (recipientId, email, etc.).
   */
  async dispatch(
    notification: Notification,
    context: DeliveryContext,
  ): Promise<void> {
    const adapter = this.adapterMap.get(notification.channel);

    if (!adapter) {
      this.logger.warn(
        `[ChannelDispatcher] No adapter registered for channel=${notification.channel} — notification ${notification.id} skipped`,
      );
      return;
    }

    const attemptNumber = (notification.deliveryAttempts ?? 0) + 1;
    const attemptedAt = new Date();

    // Push suppression: if the recipient has an active WebSocket connection,
    // suppress the push notification (it was already delivered in real-time
    // via the in_app channel). This prevents duplicate notifications for
    // online users who would otherwise receive both a WS event and an FCM
    // push popup simultaneously.
    //
    // isOnline() returns false on Redis failure (safe default) so push is
    // delivered as a fallback when presence state is unavailable.
    if (notification.channel === 'push') {
      let isOnline = false;
      try {
        isOnline = await this.presenceService.isOnline(notification.recipientId);
      } catch {
        // isOnline absorbs all errors internally and returns false — this
        // catch is a double-safety net and should never be reached.
        isOnline = false;
      }

      if (isOnline) {
        this.logger.log(
          `[ChannelDispatcher] Push suppressed: userId=${notification.recipientId} is online via WebSocket. ` +
            `Notification ${notification.id} was delivered in real-time via in_app channel.`,
        );

        // Record suppression in the delivery log for observability.
        try {
          await this.deliveryLogRepo.log({
            notificationId: notification.id,
            channel: notification.channel,
            status: 'success',
            attemptNumber,
            errorCode: 'PUSH_SUPPRESSED_USER_ONLINE',
            errorMessage:
              'Push suppressed — recipient has active WebSocket connection; delivered via in_app channel.',
            attemptedAt,
          });
        } catch (logErr) {
          this.logger.warn(
            `[ChannelDispatcher] Failed to write suppression log for id=${notification.id}: ${(logErr as Error).message}`,
          );
        }

        // Mark the push notification as sent (effectively delivered via WS).
        try {
          await this.notificationRepo.updateStatus(notification.id, 'sent', {
            deliveryAttempts: attemptNumber,
            lastAttemptAt: attemptedAt,
            sentAt: attemptedAt,
          });
        } catch (updateErr) {
          this.logger.warn(
            `[ChannelDispatcher] Failed to update suppressed push status for id=${notification.id}: ${(updateErr as Error).message}`,
          );
        }

        return; // Do not invoke FCM
      }
    }

    // 1. Invoke the channel adapter (catch any unexpected exceptions)
    let result: DeliveryResult;
    try {
      result = await adapter.deliver(notification, context);
    } catch (adapterErr) {
      this.logger.error(
        `[ChannelDispatcher] Adapter threw for channel=${notification.channel} id=${notification.id}: ${(adapterErr as Error).message}`,
        (adapterErr as Error).stack,
      );
      result = {
        success: false,
        errorCode: 'ADAPTER_EXCEPTION',
        errorMessage: (adapterErr as Error).message,
      };
    }

    this.logger.log(
      `[ChannelDispatcher] Delivery result: id=${notification.id} channel=${notification.channel} success=${result.success}${result.errorCode ? ` errorCode=${result.errorCode}` : ''}`,
    );

    // 2. Write delivery attempt log (append-only audit trail)
    try {
      await this.deliveryLogRepo.log({
        notificationId: notification.id,
        channel: notification.channel,
        status: result.success ? 'success' : 'failed',
        attemptNumber,
        errorCode: result.errorCode ?? null,
        errorMessage: result.errorMessage ?? null,
        attemptedAt,
      });
    } catch (logErr) {
      this.logger.warn(
        `[ChannelDispatcher] Failed to write delivery log for id=${notification.id}: ${(logErr as Error).message}`,
      );
      // Non-fatal: status update still proceeds
    }

    // 3. Update notification status + delivery tracking fields
    try {
      const newStatus: NotificationStatus = result.success ? 'sent' : 'failed';
      await this.notificationRepo.updateStatus(notification.id, newStatus, {
        deliveryAttempts: attemptNumber,
        lastAttemptAt: attemptedAt,
        sentAt: result.success ? attemptedAt : undefined,
      });
    } catch (updateErr) {
      this.logger.warn(
        `[ChannelDispatcher] Failed to update notification status for id=${notification.id}: ${(updateErr as Error).message}`,
      );
    }
  }
}
