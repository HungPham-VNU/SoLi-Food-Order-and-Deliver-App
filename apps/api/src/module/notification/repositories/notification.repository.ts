import { Injectable, Inject } from '@nestjs/common';
import { eq, and, desc, sql } from 'drizzle-orm';
import type { SQL } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { DB_CONNECTION } from '@/drizzle/drizzle.constants';
import * as schema from '@/drizzle/schema';
import {
  notifications,
  type NewNotification,
  type Notification,
  type NotificationStatus,
  type NotificationType,
} from '../domain/notification.schema';

// ---------------------------------------------------------------------------
// Filter shape for inbox queries
// ---------------------------------------------------------------------------

/** Optional filters applied by the inbox REST endpoint (Phase N-3). */
export interface InboxFilters {
  /** When true, only rows with is_read = false are included. */
  unreadOnly?: boolean;
  /** When set, only rows of this notification type are included. */
  type?: NotificationType;
}

/**
 * NotificationRepository
 *
 * Read/write access to `notifications`.
 * One row per notification per recipient per channel.
 *
 * Idempotency is enforced at the DB level via the UNIQUE constraint on
 * `idempotency_key`. Callers must use INSERT … ON CONFLICT DO NOTHING.
 *
 * Phase: N-1 — Foundation
 */
@Injectable()
export class NotificationRepository {
  constructor(
    @Inject(DB_CONNECTION) private readonly db: NodePgDatabase<typeof schema>,
  ) {}

  /**
   * Insert a new notification row.
   * Returns null when an identical idempotency key already exists
   * (duplicate event — safe to ignore).
   */
  async insertIfNotExists(data: NewNotification): Promise<Notification | null> {
    const result = await this.db
      .insert(notifications)
      .values(data)
      .onConflictDoNothing({ target: notifications.idempotencyKey })
      .returning();
    return result[0] ?? null;
  }

  /**
   * Fetch one page of a user's in-app inbox, newest first.
   * Used by the inbox REST endpoint (Phase N-3).
   *
   * Optional `filters` support:
   *  - unreadOnly: true  → adds WHERE is_read = false
   *  - type: <value>     → adds WHERE type = <value>
   */
  async findInboxByUserId(
    recipientId: string,
    limit: number,
    offset: number,
    filters?: InboxFilters,
  ): Promise<Notification[]> {
    return this.db
      .select()
      .from(notifications)
      .where(
        and(
          eq(notifications.recipientId, recipientId),
          eq(notifications.channel, 'in_app'),
          filters?.unreadOnly ? eq(notifications.isRead, false) : undefined,
          filters?.type ? eq(notifications.type, filters.type) : undefined,
        ) as SQL,
      )
      .orderBy(desc(notifications.createdAt))
      .limit(limit)
      .offset(offset);
  }

  /**
   * Count in-app notifications for a user matching the given filters.
   * Used alongside findInboxByUserId to compute pagination metadata.
   *
   * Reuses the same filter logic so the WHERE clause is always consistent
   * with the corresponding data page query.
   */
  async countInbox(
    recipientId: string,
    filters?: InboxFilters,
  ): Promise<number> {
    const result = await this.db
      .select({ count: sql<number>`cast(count(*) as int)` })
      .from(notifications)
      .where(
        and(
          eq(notifications.recipientId, recipientId),
          eq(notifications.channel, 'in_app'),
          filters?.unreadOnly ? eq(notifications.isRead, false) : undefined,
          filters?.type ? eq(notifications.type, filters.type) : undefined,
        ) as SQL,
      );
    return result[0]?.count ?? 0;
  }

  /**
   * Count unread in-app notifications for a user.
   * Uses the `notif_recipient_unread_idx` partial index.
   * Returns a DB-level COUNT aggregate — no rows are loaded into memory.
   */
  async countUnread(recipientId: string): Promise<number> {
    const result = await this.db
      .select({ count: sql<number>`cast(count(*) as int)` })
      .from(notifications)
      .where(
        and(
          eq(notifications.recipientId, recipientId),
          eq(notifications.channel, 'in_app'),
          eq(notifications.isRead, false),
        ),
      );
    return result[0]?.count ?? 0;
  }

  /**
   * Mark a single notification as read.
   */
  async markRead(
    notificationId: string,
    recipientId: string,
  ): Promise<Notification | null> {
    const result = await this.db
      .update(notifications)
      .set({ isRead: true, readAt: new Date(), status: 'read' })
      .where(
        and(
          eq(notifications.id, notificationId),
          eq(notifications.recipientId, recipientId),
        ),
      )
      .returning();
    return result[0] ?? null;
  }

  /**
   * Bulk mark all unread in-app notifications as read for a user.
   * Called from the "Mark all as read" inbox action.
   *
   * Returns the count of rows actually updated (0 when everything was
   * already read). Used by the REST response to inform the client.
   */
  async markAllRead(recipientId: string): Promise<number> {
    const updated = await this.db
      .update(notifications)
      .set({ isRead: true, readAt: new Date(), status: 'read' })
      .where(
        and(
          eq(notifications.recipientId, recipientId),
          eq(notifications.channel, 'in_app'),
          eq(notifications.isRead, false),
        ),
      )
      .returning({ id: notifications.id });
    return updated.length;
  }

  /**
   * Update the delivery status of a notification.
   * Used by PushService (Phase N-4) after FCM delivery.
   */
  async updateStatus(
    notificationId: string,
    status: NotificationStatus,
    extra?: Partial<Pick<Notification, 'sentAt' | 'lastAttemptAt' | 'nextRetryAt' | 'deliveryAttempts'>>,
  ): Promise<void> {
    await this.db
      .update(notifications)
      .set({ status, ...extra })
      .where(eq(notifications.id, notificationId));
  }
}
