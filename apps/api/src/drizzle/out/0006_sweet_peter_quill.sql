CREATE TYPE "public"."notification_channel" AS ENUM('in_app', 'push', 'email', 'sms');--> statement-breakpoint
CREATE TYPE "public"."notification_status" AS ENUM('pending', 'sent', 'delivered', 'read', 'failed', 'permanently_failed');--> statement-breakpoint
CREATE TYPE "public"."notification_type" AS ENUM('order_placed', 'order_confirmed', 'order_preparing', 'order_ready_for_pickup', 'order_picked_up', 'order_delivering', 'order_delivered', 'order_cancelled', 'order_refunded', 'payment_confirmed', 'payment_failed', 'refund_initiated', 'refund_completed', 'new_order_received', 'pickup_request', 'system_announcement');--> statement-breakpoint
CREATE TYPE "public"."device_platform" AS ENUM('ios', 'android', 'web');--> statement-breakpoint
CREATE TYPE "public"."delivery_attempt_status" AS ENUM('success', 'failed', 'retrying');--> statement-breakpoint
CREATE TYPE "public"."coupon_status" AS ENUM('active', 'exhausted', 'expired', 'revoked');--> statement-breakpoint
CREATE TYPE "public"."promotion_scope" AS ENUM('platform', 'restaurant');--> statement-breakpoint
CREATE TYPE "public"."promotion_status" AS ENUM('draft', 'active', 'paused', 'cancelled', 'expired');--> statement-breakpoint
CREATE TYPE "public"."promotion_trigger" AS ENUM('auto_apply', 'coupon_code');--> statement-breakpoint
CREATE TYPE "public"."promotion_type" AS ENUM('percentage', 'fixed_amount', 'free_delivery', 'reduced_delivery', 'buy_x_get_y', 'free_item');--> statement-breakpoint
CREATE TYPE "public"."stacking_mode" AS ENUM('non_stackable', 'stackable', 'exclusive');--> statement-breakpoint
CREATE TYPE "public"."usage_status" AS ENUM('reserved', 'confirmed', 'rolled_back');--> statement-breakpoint
CREATE TABLE "images" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"public_id" text NOT NULL,
	"secure_url" text NOT NULL,
	"width" integer NOT NULL,
	"height" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
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
CREATE TABLE "notification_restaurant_snapshots" (
	"restaurant_id" uuid PRIMARY KEY NOT NULL,
	"owner_id" uuid NOT NULL,
	"name" text NOT NULL,
	"last_synced_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "coupon_codes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"promotion_id" uuid NOT NULL,
	"code" text NOT NULL,
	"status" "coupon_status" DEFAULT 'active' NOT NULL,
	"max_uses" integer,
	"current_uses" integer DEFAULT 0 NOT NULL,
	"expires_at" timestamp with time zone,
	"version" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "coupon_codes_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "promotion_usages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"promotion_id" uuid NOT NULL,
	"coupon_code_id" uuid,
	"order_id" uuid NOT NULL,
	"customer_id" uuid NOT NULL,
	"discount_on_items" integer DEFAULT 0 NOT NULL,
	"discount_on_shipping" integer DEFAULT 0 NOT NULL,
	"discount_amount" integer NOT NULL,
	"status" "usage_status" DEFAULT 'reserved' NOT NULL,
	"reserved_at" timestamp with time zone DEFAULT now() NOT NULL,
	"confirmed_at" timestamp with time zone,
	"rolled_back_at" timestamp with time zone,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "promotions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"type" "promotion_type" NOT NULL,
	"scope" "promotion_scope" NOT NULL,
	"status" "promotion_status" DEFAULT 'draft' NOT NULL,
	"trigger" "promotion_trigger" NOT NULL,
	"stacking_mode" "stacking_mode" DEFAULT 'non_stackable' NOT NULL,
	"restaurant_id" uuid,
	"discount_value" integer NOT NULL,
	"min_order_amount" integer,
	"max_discount_amount" integer,
	"max_total_uses" integer,
	"current_total_uses" integer DEFAULT 0 NOT NULL,
	"max_uses_per_user" integer,
	"requires_approved_restaurant" boolean DEFAULT false NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"version" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "delivery_zones" ALTER COLUMN "base_fee" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "delivery_zones" ALTER COLUMN "per_km_rate" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "menu_items" ALTER COLUMN "price" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "modifier_options" ALTER COLUMN "price" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "order_items" ALTER COLUMN "unit_price" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "order_items" ALTER COLUMN "modifiers_price" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "order_items" ALTER COLUMN "subtotal" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "orders" ALTER COLUMN "total_amount" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "orders" ALTER COLUMN "shipping_fee" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "ordering_menu_item_snapshots" ALTER COLUMN "price" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "ordering_delivery_zone_snapshots" ALTER COLUMN "base_fee" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "ordering_delivery_zone_snapshots" ALTER COLUMN "per_km_rate" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "payment_transactions" ALTER COLUMN "amount" SET DATA TYPE integer;--> statement-breakpoint
CREATE INDEX "notif_recipient_created_idx" ON "notifications" USING btree ("recipient_id","created_at");--> statement-breakpoint
CREATE INDEX "notif_recipient_unread_idx" ON "notifications" USING btree ("recipient_id","channel") WHERE is_read = false;--> statement-breakpoint
CREATE INDEX "notif_order_idx" ON "notifications" USING btree ("order_id") WHERE order_id IS NOT NULL;--> statement-breakpoint
CREATE INDEX "notif_expires_at_idx" ON "notifications" USING btree ("expires_at") WHERE expires_at IS NOT NULL;--> statement-breakpoint
CREATE INDEX "notif_retry_idx" ON "notifications" USING btree ("next_retry_at") WHERE status = 'failed' AND next_retry_at IS NOT NULL;--> statement-breakpoint
CREATE INDEX "device_token_user_active_idx" ON "device_tokens" USING btree ("user_id","is_active") WHERE is_active = true;--> statement-breakpoint
CREATE INDEX "delivery_log_notification_idx" ON "notification_delivery_logs" USING btree ("notification_id");--> statement-breakpoint
CREATE INDEX "idx_coupon_codes_promotion_id" ON "coupon_codes" USING btree ("promotion_id");--> statement-breakpoint
CREATE INDEX "idx_coupon_codes_status" ON "coupon_codes" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_promo_usages_order_id" ON "promotion_usages" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "idx_promo_usages_promo_customer" ON "promotion_usages" USING btree ("promotion_id","customer_id");--> statement-breakpoint
CREATE INDEX "idx_promo_usages_status_reserved_at" ON "promotion_usages" USING btree ("status","reserved_at");--> statement-breakpoint
CREATE INDEX "idx_promotions_status" ON "promotions" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_promotions_restaurant_id" ON "promotions" USING btree ("restaurant_id");--> statement-breakpoint
CREATE INDEX "idx_promotions_scope_trigger_status" ON "promotions" USING btree ("scope","trigger","status");--> statement-breakpoint
CREATE INDEX "idx_promotions_ends_at" ON "promotions" USING btree ("ends_at");