import {
  pgTable,
  pgEnum,
  uuid,
  text,
  integer,
  timestamp,
  index,
} from 'drizzle-orm/pg-core';
import type { NotificationChannel } from './notification.schema';

// ---------------------------------------------------------------------------
// delivery_attempt_status enum
// ---------------------------------------------------------------------------
export const deliveryAttemptStatusEnum = pgEnum('delivery_attempt_status', [
  'success',
  'failed',
  'retrying',
]);

export type DeliveryAttemptStatus =
  (typeof deliveryAttemptStatusEnum.enumValues)[number];

// ---------------------------------------------------------------------------
// notification_delivery_logs
//
// Audit trail of every delivery attempt per notification per channel.
// Separate from `notifications` (which holds canonical state) so that:
//   - Multiple retry attempts are recorded without mutating the parent row.
//   - The audit log is queryable independently (e.g. "why did push fail?").
//
// notificationId is a logical FK — no PostgreSQL REFERENCES (D-P7).
// ---------------------------------------------------------------------------
export const notificationDeliveryLogs = pgTable(
  'notification_delivery_logs',
  {
    id: uuid('id').defaultRandom().primaryKey(),

    // Logical FK to notifications.id — no constraint (D-P7).
    notificationId: uuid('notification_id').notNull(),

    channel: text('channel').notNull().$type<NotificationChannel>(),

    status: deliveryAttemptStatusEnum('status').notNull(),

    // 1-indexed. Attempt 1 = immediate; attempt 2 = +30s; attempt 3 = +120s.
    attemptNumber: integer('attempt_number').notNull(),

    // Populated when status = 'failed' or 'retrying'.
    // Examples: 'FCM_INVALID_REGISTRATION', 'SMTP_ECONNRESET', 'DB_ERROR'
    errorCode: text('error_code'),
    errorMessage: text('error_message'),

    attemptedAt: timestamp('attempted_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    // Fast lookup: all delivery attempts for a given notification.
    // Used by support tooling: "why didn't this notification arrive?"
    index('delivery_log_notification_idx').on(t.notificationId),
  ],
);

export type NotificationDeliveryLog = typeof notificationDeliveryLogs.$inferSelect;
export type NewNotificationDeliveryLog =
  typeof notificationDeliveryLogs.$inferInsert;
