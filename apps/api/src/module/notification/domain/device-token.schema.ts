import {
  pgTable,
  pgEnum,
  uuid,
  text,
  boolean,
  timestamp,
  unique,
  index,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

// ---------------------------------------------------------------------------
// device_platform enum
// ---------------------------------------------------------------------------
export const devicePlatformEnum = pgEnum('device_platform', [
  'ios',
  'android',
  'web',
]);

export type DevicePlatform = (typeof devicePlatformEnum.enumValues)[number];

// ---------------------------------------------------------------------------
// device_tokens
//
// Stores FCM registration tokens for push notification delivery.
// One user may have multiple rows (phone + tablet + browser).
// firebase-admin.messaging().sendEach() fans out to all active tokens.
//
// Cross-context: userId is a plain UUID — no FK constraint (D-P7).
// ---------------------------------------------------------------------------
export const deviceTokens = pgTable(
  'device_tokens',
  {
    id: uuid('id').defaultRandom().primaryKey(),

    // Cross-context reference — no PostgreSQL REFERENCES (D-P7)
    userId: uuid('user_id').notNull(),

    // FCM registration token — typically 152-character alphanumeric string.
    // Uniqueness is enforced per user (same token cannot be registered twice
    // for the same user — ON CONFLICT DO UPDATE keeps last_seen_at fresh).
    token: text('token').notNull(),

    platform: devicePlatformEnum('platform').notNull(),

    // False when Firebase returns INVALID_REGISTRATION or NOT_REGISTERED.
    // PushService deactivates tokens immediately on these errors.
    isActive: boolean('is_active').notNull().default(true),

    // Updated on each successful push. Used by cleanup cron (Phase N-5):
    //   DELETE WHERE is_active = false AND last_seen_at < NOW() - '30 days'
    //   DELETE WHERE is_active = true  AND last_seen_at < NOW() - '90 days'
    lastSeenAt: timestamp('last_seen_at', { withTimezone: true }).notNull().defaultNow(),

    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    // Prevent duplicate token registration for the same user.
    // ON CONFLICT (user_id, token) DO UPDATE last_seen_at = NOW() in PushService.
    unique('device_token_user_token_unique').on(t.userId, t.token),

    // PushService.sendToUser(userId): fetch all active tokens for delivery fan-out.
    // Partial index — excludes inactive tokens (won't be sent to).
    index('device_token_user_active_idx')
      .on(t.userId, t.isActive)
      .where(sql`is_active = true`),
  ],
);

export type DeviceToken = typeof deviceTokens.$inferSelect;
export type NewDeviceToken = typeof deviceTokens.$inferInsert;
