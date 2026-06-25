import {
  pgTable,
  uuid,
  text,
  boolean,
  integer,
  jsonb,
  timestamp,
} from 'drizzle-orm/pg-core';
import type { NotificationType } from './notification.schema';

// ---------------------------------------------------------------------------
// notification_preferences
//
// Per-user notification settings: channel opt-in/opt-out, quiet hours,
// muted notification types, and user email (denormalised to avoid
// querying IAM at notification delivery time).
//
// One row per user (UNIQUE on user_id). Rows are created lazily — only when
// the user first updates preferences. Until then, DEFAULT_PREFERENCES
// (defined in notification.service.ts) is used as the fallback.
//
// Cross-context: userId is a plain UUID — no FK constraint (D-P7).
// ---------------------------------------------------------------------------
export const notificationPreferences = pgTable('notification_preferences', {
  id: uuid('id').defaultRandom().primaryKey(),

  // One row per user. Unique constraint enforces this without a composite PK.
  userId: uuid('user_id').notNull().unique(),

  // ---- Per-channel opt-in ----
  // Defaults are permissive: all channels enabled except SMS (cost + compliance).
  pushEnabled: boolean('push_enabled').notNull().default(true),
  inAppEnabled: boolean('in_app_enabled').notNull().default(true),
  emailEnabled: boolean('email_enabled').notNull().default(true),
  smsEnabled: boolean('sms_enabled').notNull().default(false),

  // ---- Quiet hours (24-hour format, inclusive start, exclusive end) ----
  // null = quiet hours disabled.
  // Example: quietHoursStart=22, quietHoursEnd=7 means 22:00–06:59 is quiet.
  // Overnight ranges (start > end) are supported in isQuietHours().
  quietHoursStart: integer('quiet_hours_start'), // 0–23, null = disabled
  quietHoursEnd: integer('quiet_hours_end'), // 0–23, null = disabled

  // ---- Muted notification types ----
  // JSONB array of NotificationType values the user has muted.
  // The notification is still written to DB (for audit) but delivery is skipped.
  mutedTypes: jsonb('muted_types').$type<NotificationType[]>().default([]),

  // ---- User email (denormalised) ----
  // Stored here to avoid querying IAM at email delivery time.
  // Should be kept in sync via UserProfileUpdatedEvent when that event exists.
  email: text('email'),

  // ---- Timezone for quiet hours ----
  // IANA timezone string (e.g. 'Asia/Ho_Chi_Minh').
  // Default is correct for the primary market (Vietnam UTC+7).
  // Used by isQuietHours() to compute local hour from UTC now.
  timezone: text('timezone').notNull().default('Asia/Ho_Chi_Minh'),

  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type NotificationPreference =
  typeof notificationPreferences.$inferSelect;
export type NewNotificationPreference =
  typeof notificationPreferences.$inferInsert;

// ---------------------------------------------------------------------------
// DEFAULT_PREFERENCES
//
// Used as a fallback when no preference row exists for a user.
// Must match the column defaults above — kept in sync manually.
// ---------------------------------------------------------------------------
export const DEFAULT_PREFERENCES: Pick<
  NotificationPreference,
  | 'pushEnabled'
  | 'inAppEnabled'
  | 'emailEnabled'
  | 'smsEnabled'
  | 'quietHoursStart'
  | 'quietHoursEnd'
  | 'mutedTypes'
  | 'timezone'
> = {
  pushEnabled: true,
  inAppEnabled: true,
  emailEnabled: true,
  smsEnabled: false,
  quietHoursStart: null,
  quietHoursEnd: null,
  mutedTypes: [],
  timezone: 'Asia/Ho_Chi_Minh',
};
