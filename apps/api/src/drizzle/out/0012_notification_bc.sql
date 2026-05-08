-- Migration: 0012_notification_bc.sql
-- Purpose:   Phase N-1 — Notification bounded context foundation.
--
-- Creates:
--   1. notification_type enum         — 16 distinct notification type values
--   2. notification_channel enum      — 4 delivery channels
--   3. notification_status enum       — 6 notification lifecycle states
--   4. device_platform enum           — 3 device platforms for push tokens
--   5. delivery_attempt_status enum   — 3 attempt outcome values
--
--   Tables:
--   6.  notifications                      — canonical notification row (1 per recipient per channel)
--   7.  device_tokens                      — FCM push tokens per user device
--   8.  notification_preferences           — per-user channel opt-ins + quiet hours
--   9.  notification_delivery_logs         — append-only delivery attempt audit log
--   10. notification_restaurant_snapshots  — ACL projection (restaurantId → ownerId + name)
--
-- All cross-context references (recipient_id, order_id, user_id) are plain
-- UUIDs — no FOREIGN KEY constraints (microservice-readiness principle D-P7).
--
-- Idempotency:
--   The UNIQUE constraint on notifications.idempotency_key prevents duplicate
--   rows under event replay. Callers use ON CONFLICT DO NOTHING.
-- ---------------------------------------------------------------------------

---------------------------------------------------------------------------
-- 1. notification_type enum
---------------------------------------------------------------------------
CREATE TYPE "notification_type" AS ENUM (
  'order_placed',
  'order_confirmed',
  'order_preparing',
  'order_ready_for_pickup',
  'order_picked_up',
  'order_delivering',
  'order_delivered',
  'order_cancelled',
  'order_refunded',
  'payment_confirmed',
  'payment_failed',
  'refund_initiated',
  'refund_completed',
  'new_order_received',
  'pickup_request',
  'system_announcement'
);

---------------------------------------------------------------------------
-- 2. notification_channel enum
---------------------------------------------------------------------------
CREATE TYPE "notification_channel" AS ENUM (
  'in_app',
  'push',
  'email',
  'sms'
);

---------------------------------------------------------------------------
-- 3. notification_status enum
---------------------------------------------------------------------------
CREATE TYPE "notification_status" AS ENUM (
  'pending',
  'sent',
  'delivered',
  'read',
  'failed',
  'permanently_failed'
);

---------------------------------------------------------------------------
-- 4. device_platform enum
---------------------------------------------------------------------------
CREATE TYPE "device_platform" AS ENUM (
  'ios',
  'android',
  'web'
);

---------------------------------------------------------------------------
-- 5. delivery_attempt_status enum
---------------------------------------------------------------------------
CREATE TYPE "delivery_attempt_status" AS ENUM (
  'success',
  'failed',
  'retrying'
);

---------------------------------------------------------------------------
-- 6. notifications
---------------------------------------------------------------------------
CREATE TABLE "notifications" (
  "id"                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "recipient_id"        uuid NOT NULL,
  "recipient_role"      text NOT NULL,
  "type"                "notification_type" NOT NULL,
  "channel"             "notification_channel" NOT NULL,
  "title"               text NOT NULL,
  "body"                text NOT NULL,
  "data"                jsonb,
  "status"              "notification_status" NOT NULL DEFAULT 'pending',
  "is_read"             boolean NOT NULL DEFAULT false,
  "read_at"             timestamptz,
  "order_id"            uuid,
  "idempotency_key"     text NOT NULL UNIQUE,
  "delivery_attempts"   integer NOT NULL DEFAULT 0,
  "last_attempt_at"     timestamptz,
  "next_retry_at"       timestamptz,
  "created_at"          timestamptz NOT NULL DEFAULT now(),
  "sent_at"             timestamptz,
  "expires_at"          timestamptz
);

-- Primary read path: user's inbox paginated by newest-first
CREATE INDEX "notif_recipient_created_idx"
  ON "notifications" ("recipient_id", "created_at");

-- Fast unread COUNT query — partial index covers (recipient_id, channel) WHERE is_read = false
-- so countUnread (channel = 'in_app') and inbox queries can use an index-only scan
CREATE INDEX "notif_recipient_unread_idx"
  ON "notifications" ("recipient_id", "channel")
  WHERE is_read = false;

-- Admin / support: notifications for a specific order
CREATE INDEX "notif_order_idx"
  ON "notifications" ("order_id")
  WHERE order_id IS NOT NULL;

-- Cleanup cron: find notifications due for deletion
CREATE INDEX "notif_expires_at_idx"
  ON "notifications" ("expires_at")
  WHERE expires_at IS NOT NULL;

-- Retry worker (Phase N-6): find failed notifications due for retry
CREATE INDEX "notif_retry_idx"
  ON "notifications" ("next_retry_at")
  WHERE status = 'failed' AND next_retry_at IS NOT NULL;

---------------------------------------------------------------------------
-- 7. device_tokens
---------------------------------------------------------------------------
CREATE TABLE "device_tokens" (
  "id"            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id"       uuid NOT NULL,
  "token"         text NOT NULL,
  "platform"      "device_platform" NOT NULL,
  "is_active"     boolean NOT NULL DEFAULT true,
  "last_seen_at"  timestamptz NOT NULL DEFAULT now(),
  "created_at"    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "device_token_user_token_unique" UNIQUE ("user_id", "token")
);

-- PushService fan-out: all active tokens for a user
CREATE INDEX "device_token_user_active_idx"
  ON "device_tokens" ("user_id", "is_active")
  WHERE is_active = true;

---------------------------------------------------------------------------
-- 8. notification_preferences
---------------------------------------------------------------------------
CREATE TABLE "notification_preferences" (
  "id"                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id"            uuid NOT NULL UNIQUE,
  "push_enabled"       boolean NOT NULL DEFAULT true,
  "in_app_enabled"     boolean NOT NULL DEFAULT true,
  "email_enabled"      boolean NOT NULL DEFAULT true,
  "sms_enabled"        boolean NOT NULL DEFAULT false,
  "quiet_hours_start"  integer,
  "quiet_hours_end"    integer,
  "muted_types"        jsonb DEFAULT '[]',
  "email"              text,
  "timezone"           text NOT NULL DEFAULT 'Asia/Ho_Chi_Minh',
  "created_at"         timestamptz NOT NULL DEFAULT now(),
  "updated_at"         timestamptz NOT NULL DEFAULT now()
);

---------------------------------------------------------------------------
-- 9. notification_delivery_logs
---------------------------------------------------------------------------
CREATE TABLE "notification_delivery_logs" (
  "id"               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "notification_id"  uuid NOT NULL,
  "channel"          text NOT NULL,
  "status"           "delivery_attempt_status" NOT NULL,
  "attempt_number"   integer NOT NULL,
  "error_code"       text,
  "error_message"    text,
  "attempted_at"     timestamptz NOT NULL DEFAULT now()
);

-- Support tooling: all delivery attempts for a given notification
CREATE INDEX "delivery_log_notification_idx"
  ON "notification_delivery_logs" ("notification_id");

---------------------------------------------------------------------------
-- 10. notification_restaurant_snapshots
--
-- ACL projection: restaurantId → { ownerId, name }
-- Populated by NotificationRestaurantSnapshotProjector.
---------------------------------------------------------------------------
CREATE TABLE "notification_restaurant_snapshots" (
  "restaurant_id"   uuid PRIMARY KEY,
  "owner_id"        uuid NOT NULL,
  "name"            text NOT NULL,
  "last_synced_at"  timestamptz NOT NULL DEFAULT now()
);
