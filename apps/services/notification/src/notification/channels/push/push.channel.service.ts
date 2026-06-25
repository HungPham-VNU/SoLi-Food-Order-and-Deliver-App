import { Injectable, Inject, Logger } from '@nestjs/common';
import type { Notification } from '../../domain/notification.schema';
import { DeviceTokenRepository } from '../../repositories/device-token.repository';
import { PUSH_PROVIDER } from './push-provider.interface';
import type { IPushProvider } from './push-provider.interface';
import type {
  INotificationChannel,
  DeliveryContext,
  DeliveryResult,
} from '../channel.interface';

/**
 * PushChannelService
 *
 * Delivers a push notification to all active device tokens for the recipient.
 *
 * Flow:
 *  1. Fetch all active device tokens for the recipient from device_tokens.
 *  2. If no tokens → return { success: false, errorCode: 'NO_ACTIVE_TOKENS' }.
 *  3. Fan-out to all tokens via IPushProvider.send().
 *  4. Deactivate tokens returned as invalid by the provider
 *     (FCM: INVALID_REGISTRATION, NOT_REGISTERED).
 *  5. Return success = true when at least one token was delivered.
 *
 * Error codes:
 *   NO_ACTIVE_TOKENS  — user has no registered push tokens
 *   FCM_SEND_ERROR    — provider returned a fatal error
 *
 * Multi-device behaviour:
 *  A user may have multiple active tokens (phone + tablet + browser).
 *  All are sent to in a single fan-out call. Token deactivation is
 *  per-token, so a stale phone token does not block a valid tablet token.
 *
 * MUST NOT throw — all errors are caught and expressed as DeliveryResult.
 *
 * Migration path: swap PUSH_PROVIDER binding in NotificationModule to
 * FirebasePushProvider without any changes here.
 *
 * Phase: N-4 — Multi-Channel Delivery
 */
@Injectable()
export class PushChannelService implements INotificationChannel {
  private readonly logger = new Logger(PushChannelService.name);

  constructor(
    private readonly deviceTokenRepo: DeviceTokenRepository,
    @Inject(PUSH_PROVIDER) private readonly pushProvider: IPushProvider,
  ) {}

  async deliver(
    notification: Notification,
    _context: DeliveryContext,
  ): Promise<DeliveryResult> {
    // 1. Fetch active tokens for the recipient
    let tokens: Awaited<
      ReturnType<DeviceTokenRepository['findActiveByUserId']>
    >;
    try {
      tokens = await this.deviceTokenRepo.findActiveByUserId(
        notification.recipientId,
      );
    } catch (err) {
      this.logger.error(
        `[Push] Token lookup failed for userId=${notification.recipientId}: ${(err as Error).message}`,
      );
      return {
        success: false,
        errorCode: 'FCM_SEND_ERROR',
        errorMessage: `Token lookup failed: ${(err as Error).message}`,
      };
    }

    if (tokens.length === 0) {
      this.logger.debug(
        `[Push] No active tokens for userId=${notification.recipientId} — skipping push for notification ${notification.id}`,
      );
      return {
        success: false,
        errorCode: 'NO_ACTIVE_TOKENS',
        errorMessage: 'User has no registered push device tokens',
      };
    }

    // 2. Fan-out push to all active tokens
    let result: Awaited<ReturnType<IPushProvider['send']>>;
    try {
      result = await this.pushProvider.send({
        tokens: tokens.map((t) => t.token),
        title: notification.title,
        body: notification.body,
        data: notification.data ?? undefined,
      });
    } catch (err) {
      this.logger.error(
        `[Push] Provider error for notification ${notification.id}: ${(err as Error).message}`,
      );
      return {
        success: false,
        errorCode: 'FCM_SEND_ERROR',
        errorMessage: (err as Error).message,
      };
    }

    this.logger.log(
      `[Push] Fan-out result for notification ${notification.id}: ` +
        `tokens=${tokens.length} success=${result.successCount} failed=${result.failureCount} invalid=${result.invalidTokens.length}`,
    );

    // 3. Deactivate invalid tokens (stale / unregistered)
    if (result.invalidTokens.length > 0) {
      for (const invalidToken of result.invalidTokens) {
        try {
          await this.deviceTokenRepo.deactivate(
            notification.recipientId,
            invalidToken,
          );
          this.logger.log(
            `[Push] Deactivated invalid token for userId=${notification.recipientId}`,
          );
        } catch (deactivateErr) {
          // Non-fatal: log and continue
          this.logger.warn(
            `[Push] Failed to deactivate invalid token: ${(deactivateErr as Error).message}`,
          );
        }
      }
    }

    // 4. Resolve delivery success: at least one token delivered
    const success = result.successCount > 0;
    if (!success) {
      return {
        success: false,
        errorCode: 'FCM_SEND_ERROR',
        errorMessage: `All ${tokens.length} token(s) failed delivery`,
      };
    }

    return { success: true };
  }
}
