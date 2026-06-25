import { Injectable, Inject } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { DB_CONNECTION } from '@/drizzle/drizzle.constants';
import {
  notificationDeliveryLogs,
  type NewNotificationDeliveryLog,
  type NotificationDeliveryLog,
} from '../domain/notification-delivery-log.schema';

/**
 * NotificationDeliveryLogRepository
 *
 * Write access to `notification_delivery_logs`.
 * One row per delivery attempt — never mutated, only appended.
 *
 * Phase: N-1 — Foundation (schema + repo stub)
 * Used actively: Phase N-4 (PushService records each FCM attempt)
 */
@Injectable()
export class NotificationDeliveryLogRepository {
  constructor(@Inject(DB_CONNECTION) private readonly db: NodePgDatabase) {}

  /**
   * Record one delivery attempt.
   * Called after every push/email/sms dispatch attempt (success or failure).
   */
  async log(data: NewNotificationDeliveryLog): Promise<void> {
    await this.db.insert(notificationDeliveryLogs).values(data);
  }

  /**
   * Fetch all delivery attempts for a notification (support tooling).
   */
  async findByNotificationId(
    notificationId: string,
  ): Promise<NotificationDeliveryLog[]> {
    return this.db
      .select()
      .from(notificationDeliveryLogs)
      .where(eq(notificationDeliveryLogs.notificationId, notificationId));
  }
}
