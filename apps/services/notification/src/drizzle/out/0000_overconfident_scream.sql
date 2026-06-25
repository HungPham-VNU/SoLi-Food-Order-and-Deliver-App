CREATE TYPE "public"."device_platform" AS ENUM('ios', 'android', 'web');--> statement-breakpoint
CREATE TYPE "public"."delivery_attempt_status" AS ENUM('success', 'failed', 'retrying');--> statement-breakpoint
CREATE TYPE "public"."notification_channel" AS ENUM('in_app', 'push', 'email', 'sms');--> statement-breakpoint
CREATE TYPE "public"."notification_status" AS ENUM('pending', 'sent', 'delivered', 'read', 'failed', 'permanently_failed');--> statement-breakpoint
CREATE TYPE "public"."notification_type" AS ENUM('order_placed', 'order_confirmed', 'order_preparing', 'order_ready_for_pickup', 'order_picked_up', 'order_delivering', 'order_delivered', 'order_cancelled', 'order_refunded', 'payment_confirmed', 'payment_failed', 'refund_initiated', 'refund_completed', 'new_order_received', 'new_review', 'pickup_request', 'system_announcement');--> statement-breakpoint
CREATE TABLE "device_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"token" text NOT NULL,
	"platform" "device_platform" NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "device_token_user_token_unique" UNIQUE("user_id","token")
);
--> statement-breakpoint
CREATE TABLE "notification_delivery_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"notification_id" uuid NOT NULL,
	"channel" text NOT NULL,
	"status" "delivery_attempt_status" NOT NULL,
	"attempt_number" integer NOT NULL,
	"error_code" text,
	"error_message" text,
	"attempted_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notification_preferences" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"push_enabled" boolean DEFAULT true NOT NULL,
	"in_app_enabled" boolean DEFAULT true NOT NULL,
	"email_enabled" boolean DEFAULT true NOT NULL,
	"sms_enabled" boolean DEFAULT false NOT NULL,
	"quiet_hours_start" integer,
	"quiet_hours_end" integer,
	"muted_types" jsonb DEFAULT '[]'::jsonb,
	"email" text,
	"timezone" text DEFAULT 'Asia/Ho_Chi_Minh' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "notification_preferences_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"recipient_id" uuid NOT NULL,
	"recipient_role" text NOT NULL,
	"type" "notification_type" NOT NULL,
	"channel" "notification_channel" NOT NULL,
	"title" text NOT NULL,
	"body" text NOT NULL,
	"data" jsonb,
	"status" "notification_status" DEFAULT 'pending' NOT NULL,
	"is_read" boolean DEFAULT false NOT NULL,
	"read_at" timestamp with time zone,
	"order_id" uuid,
	"idempotency_key" text NOT NULL,
	"delivery_attempts" integer DEFAULT 0 NOT NULL,
	"last_attempt_at" timestamp with time zone,
	"next_retry_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"sent_at" timestamp with time zone,
	"expires_at" timestamp with time zone,
	CONSTRAINT "notifications_idempotency_key_unique" UNIQUE("idempotency_key")
);
--> statement-breakpoint
CREATE TABLE "notification_restaurant_snapshots" (
	"restaurant_id" uuid PRIMARY KEY NOT NULL,
	"owner_id" uuid NOT NULL,
	"name" text NOT NULL,
	"last_synced_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "inbox_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"consumer" text NOT NULL,
	"event_id" uuid NOT NULL,
	"event_type" text NOT NULL,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL,
	"processed_at" timestamp with time zone,
	"attempt_count" integer DEFAULT 0 NOT NULL,
	"last_error" text,
	CONSTRAINT "inbox_consumer_event_unique" UNIQUE("consumer","event_id")
);
--> statement-breakpoint
CREATE INDEX "device_token_user_active_idx" ON "device_tokens" USING btree ("user_id","is_active") WHERE is_active = true;--> statement-breakpoint
CREATE INDEX "delivery_log_notification_idx" ON "notification_delivery_logs" USING btree ("notification_id");--> statement-breakpoint
CREATE INDEX "notif_recipient_created_idx" ON "notifications" USING btree ("recipient_id","created_at");--> statement-breakpoint
CREATE INDEX "notif_recipient_unread_idx" ON "notifications" USING btree ("recipient_id","channel") WHERE is_read = false;--> statement-breakpoint
CREATE INDEX "notif_order_idx" ON "notifications" USING btree ("order_id") WHERE order_id IS NOT NULL;--> statement-breakpoint
CREATE INDEX "notif_expires_at_idx" ON "notifications" USING btree ("expires_at") WHERE expires_at IS NOT NULL;--> statement-breakpoint
CREATE INDEX "notif_retry_idx" ON "notifications" USING btree ("next_retry_at") WHERE status = 'failed' AND next_retry_at IS NOT NULL;