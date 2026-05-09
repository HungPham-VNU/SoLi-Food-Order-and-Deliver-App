import {
  pgTable,
  pgEnum,
  uuid,
  text,
  boolean,
  integer,
  jsonb,
  timestamp,
  index,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

// ---------------------------------------------------------------------------
// notification_type enum
//
// All notification types this BC can produce.
// Types marked [RESERVED] exist in the enum now to avoid a breaking migration
// when the Delivery BC or full refund webhook is added.
// ---------------------------------------------------------------------------
export const notificationTypeEnum = pgEnum('notification_type', [
  // --- Ordering events (customer-facing) ---
  'order_placed',           // Customer: order successfully placed
  'order_confirmed',        // Customer: restaurant accepted the order
  'order_preparing',        // Customer: restaurant started cooking
  'order_ready_for_pickup', // Customer: food ready — shipper is coming (preparing → ready_for_pickup)
  'order_picked_up',        // Customer: shipper collected the order
  'order_delivering',       // Customer: shipper is en route
  'order_delivered',        // Customer: order delivered successfully
  'order_cancelled',        // Customer + Restaurant owner: order was cancelled
  'order_refunded',         // Customer: refund processed (delivered → refunded)

  // --- Payment events ---
  'payment_confirmed',      // Customer: VNPay payment succeeded
  'payment_failed',         // Customer: VNPay payment failed; retry instructions

  // --- Refund events ---
  'refund_initiated',       // Customer: refund process started after cancellation
  'refund_completed',       // [RESERVED] Payment BC refund webhook — not yet available

  // --- Restaurant-facing events ---
  'new_order_received',     // Restaurant owner: new order waiting for confirmation

  // --- Shipper-facing events (Delivery BC — future) ---
  'pickup_request',         // [RESERVED] Shipper: order ready to be picked up

  // --- System ---
  'system_announcement',    // Admin broadcast to all users
]);

export type NotificationType = (typeof notificationTypeEnum.enumValues)[number];

// ---------------------------------------------------------------------------
// notification_channel enum
// ---------------------------------------------------------------------------
export const notificationChannelEnum = pgEnum('notification_channel', [
  'in_app',
  'push',
  'email',
  'sms',
]);

export type NotificationChannel = (typeof notificationChannelEnum.enumValues)[number];

// ---------------------------------------------------------------------------
// notification_status enum
//
// State machine:
//   pending → sent → delivered
//   pending → failed → permanently_failed
//   sent    → read
// ---------------------------------------------------------------------------
export const notificationStatusEnum = pgEnum('notification_status', [
  'pending',            // Created, not yet dispatched
  'sent',               // Dispatched to channel provider (FCM ACKed, SMTP queued)
  'delivered',          // Provider confirmed delivery (FCM delivery receipt)
  'read',               // User opened or explicitly marked as read
  'failed',             // Delivery failed; eligible for retry
  'permanently_failed', // Exhausted retries; archived for audit
]);

export type NotificationStatus = (typeof notificationStatusEnum.enumValues)[number];

// ---------------------------------------------------------------------------
// notifications
//
// One row per notification per recipient per channel.
// e.g. an OrderPlacedEvent produces TWO rows: one 'in_app' + one 'push'.
// Each row has its own idempotency key, status, and delivery tracking.
//
// Cross-context references (recipientId, orderId) are plain UUIDs — no FK
// constraints, following the microservice-readiness principle (D-P7).
// ---------------------------------------------------------------------------
export const notifications = pgTable(
  'notifications',
  {
    id: uuid('id').defaultRandom().primaryKey(),

    // --- Recipient ---
    // Cross-context reference — no PostgreSQL REFERENCES (D-P7)
    recipientId: uuid('recipient_id').notNull(),
    recipientRole: text('recipient_role').notNull(), // 'customer' | 'restaurant' | 'shipper' | 'admin'

    // --- Classification ---
    type: notificationTypeEnum('type').notNull(),
    channel: notificationChannelEnum('channel').notNull(),

    // --- Content ---
    title: text('title').notNull(),
    body: text('body').notNull(),
    // Structured data for deep links and frontend routing.
    // e.g. { orderId: 'abc-123', screen: 'OrderDetail' }
    data: jsonb('data').$type<Record<string, string>>(),

    // --- State ---
    status: notificationStatusEnum('status').notNull().default('pending'),
    isRead: boolean('is_read').notNull().default(false),
    readAt: timestamp('read_at', { withTimezone: true }),

    // --- Context reference (no FK) ---
    // Stored for admin/support queries across the notification table.
    orderId: uuid('order_id'),

    // --- Idempotency ---
    // Format: notif:{type}:{sourceId}:{recipientId}:{channel}
    // UNIQUE constraint prevents duplicate rows even under event replay.
    // ON CONFLICT DO NOTHING ensures silent skip of exact duplicates.
    idempotencyKey: text('idempotency_key').unique().notNull(),

    // --- Delivery tracking ---
    deliveryAttempts: integer('delivery_attempts').notNull().default(0),
    lastAttemptAt: timestamp('last_attempt_at', { withTimezone: true }),
    nextRetryAt: timestamp('next_retry_at', { withTimezone: true }),

    // --- Timestamps ---
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    sentAt: timestamp('sent_at', { withTimezone: true }),
    // Set at creation: NOW() + 90 days. Cleanup cron deletes expired read rows.
    expiresAt: timestamp('expires_at', { withTimezone: true }),
  },
  (t) => [
    // Primary read path: user's inbox paginated by newest-first.
    // Covers: WHERE recipient_id = $1 ORDER BY created_at DESC
    index('notif_recipient_created_idx').on(t.recipientId, t.createdAt),

    // Fast unread COUNT query. Partial index (only unread rows) — keeps
    // the index small as the majority of notifications will eventually be read.
    // Includes `channel` so the countUnread query (WHERE recipient_id = $1
    // AND channel = 'in_app' AND is_read = false) can use an index-only scan.
    index('notif_recipient_unread_idx')
      .on(t.recipientId, t.channel)
      .where(sql`is_read = false`),

    // Admin / support: look up all notifications for a specific order.
    // Partial index excludes NULL order_id rows (e.g. system_announcement).
    index('notif_order_idx').on(t.orderId).where(sql`order_id IS NOT NULL`),

    // Cleanup cron: find notifications due for deletion.
    // Partial index excludes rows with no expiry (e.g. unread critical alerts).
    index('notif_expires_at_idx').on(t.expiresAt).where(sql`expires_at IS NOT NULL`),

    // Retry worker (Phase N-6): find failed notifications due for retry.
    index('notif_retry_idx')
      .on(t.nextRetryAt)
      .where(sql`status = 'failed' AND next_retry_at IS NOT NULL`),
  ],
);

export type Notification = typeof notifications.$inferSelect;
export type NewNotification = typeof notifications.$inferInsert;
