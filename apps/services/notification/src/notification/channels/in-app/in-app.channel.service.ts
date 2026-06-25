import { Injectable, Logger, Optional } from '@nestjs/common';
import type { Notification } from '../../domain/notification.schema';
import { NotificationGateway } from '../../gateway/extracted-notification.gateway';
import { WS_NOTIFICATION_CREATED } from '../../gateway/notification-payload.dto';
import type { NotificationPayload } from '../../gateway/notification-payload.dto';
import { RedisService } from '@/lib/redis/redis.service';
import type {
  INotificationChannel,
  DeliveryContext,
  DeliveryResult,
} from '../channel.interface';

/**
 * InAppChannelService
 *
 * Handles in-app delivery for a persisted notification:
 *  1. Invalidates the per-user unread count cache (Redis DEL).
 *  2. Emits a 'notification.created' WebSocket event to the user's room
 *     via NotificationGateway (best-effort — a WS failure is not a
 *     delivery failure because the notification is already in the DB and
 *     accessible via the inbox REST API).
 *
 * Delivery is always considered successful for in_app:
 *  - The canonical notification record is already persisted before
 *    deliver() is called (persistence happens in NotificationService).
 *  - The WebSocket emit is a real-time enhancement, not the primary
 *    delivery mechanism.
 *
 * NotificationGateway is @Optional() to support unit-test contexts where
 * the gateway is not registered. In production it is always present.
 *
 * IMPORTANT: Do NOT use a union type (e.g. NotificationGateway | null) for
 * the gateway parameter. TypeScript compiles union types to `Object` in
 * Reflect.metadata — NestJS DI cannot resolve `Object` to NotificationGateway
 * and @Optional() would always inject undefined, silently disabling realtime.
 *
 * Phase: N-4 — Multi-Channel Delivery (extracted from NotificationService)
 */
@Injectable()
export class InAppChannelService implements INotificationChannel {
  private readonly logger = new Logger(InAppChannelService.name);

  constructor(
    private readonly redisService: RedisService,
    @Optional() private readonly gateway: NotificationGateway,
  ) {}

  async deliver(
    notification: Notification,
    _context: DeliveryContext,
  ): Promise<DeliveryResult> {
    // 1. Invalidate unread count cache so the next badge request is accurate
    try {
      await this.redisService.del(`unread:${notification.recipientId}`);
    } catch (cacheErr) {
      this.logger.warn(
        `[InApp] Cache invalidation failed for userId=${notification.recipientId}: ${(cacheErr as Error).message}`,
      );
      // Cache failure is not a delivery failure — continue
    }

    // 2. Emit WebSocket event (best-effort)
    if (this.gateway) {
      try {
        const payload: NotificationPayload = {
          id: notification.id,
          type: notification.type,
          title: notification.title,
          body: notification.body,
          data: notification.data ?? undefined,
          orderId: notification.orderId ?? undefined,
          createdAt: notification.createdAt.toISOString(),
          isRead: notification.isRead,
        };
        this.gateway.sendToUser(
          notification.recipientId,
          WS_NOTIFICATION_CREATED,
          payload,
        );
        this.logger.log(
          `[InApp] WS emitted: id=${notification.id} userId=${notification.recipientId}`,
        );
      } catch (wsErr) {
        this.logger.warn(
          `[InApp] WS emit failed for id=${notification.id}: ${(wsErr as Error).message}`,
        );
        // Not a delivery failure — notification is persisted and accessible via inbox
      }
    } else {
      this.logger.debug(
        `[InApp] No gateway available — WS emit skipped for id=${notification.id}`,
      );
    }

    // in_app delivery is always considered successful (notification is in DB)
    return { success: true };
  }
}
