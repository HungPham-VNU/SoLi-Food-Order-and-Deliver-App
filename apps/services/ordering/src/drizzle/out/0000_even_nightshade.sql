CREATE TYPE "public"."order_cancellation_reason" AS ENUM('kitchen_cancel', 'driver_no_show', 'out_of_stock', 'customer_request', 'payment_failed', 'timeout', 'other');--> statement-breakpoint
CREATE TYPE "public"."order_status" AS ENUM('pending', 'paid', 'confirmed', 'preparing', 'ready_for_pickup', 'picked_up', 'delivering', 'delivered', 'cancelled', 'refunded');--> statement-breakpoint
CREATE TYPE "public"."order_payment_method" AS ENUM('cod', 'vnpay');--> statement-breakpoint
CREATE TYPE "public"."order_triggered_by_role" AS ENUM('customer', 'restaurant', 'shipper', 'admin', 'system');--> statement-breakpoint
CREATE TYPE "public"."ordering_menu_item_status" AS ENUM('available', 'unavailable', 'out_of_stock');--> statement-breakpoint
CREATE TABLE "order_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"menu_item_id" uuid NOT NULL,
	"item_name" text NOT NULL,
	"unit_price" integer NOT NULL,
	"modifiers_price" integer DEFAULT 0 NOT NULL,
	"quantity" integer NOT NULL,
	"subtotal" integer NOT NULL,
	"modifiers" jsonb DEFAULT '[]'::jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "order_status_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"from_status" "order_status",
	"to_status" "order_status" NOT NULL,
	"triggered_by" uuid,
	"triggered_by_role" "order_triggered_by_role" NOT NULL,
	"note" text,
	"cancellation_reason" "order_cancellation_reason",
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"customer_id" uuid NOT NULL,
	"restaurant_id" uuid NOT NULL,
	"restaurant_name" text NOT NULL,
	"cart_id" uuid NOT NULL,
	"status" "order_status" DEFAULT 'pending' NOT NULL,
	"total_amount" integer NOT NULL,
	"shipping_fee" integer DEFAULT 0 NOT NULL,
	"discount_amount" integer DEFAULT 0 NOT NULL,
	"estimated_delivery_minutes" real,
	"payment_method" "order_payment_method" NOT NULL,
	"delivery_address" jsonb NOT NULL,
	"note" text,
	"payment_url" text,
	"expires_at" timestamp with time zone,
	"reviewed_at" timestamp with time zone,
	"version" integer DEFAULT 0 NOT NULL,
	"shipper_id" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "orders_cart_id_unique" UNIQUE("cart_id")
);
--> statement-breakpoint
CREATE TABLE "app_settings" (
	"key" text PRIMARY KEY NOT NULL,
	"value" text NOT NULL,
	"description" text,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ordering_delivery_zone_snapshots" (
	"zone_id" uuid PRIMARY KEY NOT NULL,
	"restaurant_id" uuid NOT NULL,
	"name" text NOT NULL,
	"radius_km" double precision NOT NULL,
	"base_fee" integer NOT NULL,
	"per_km_rate" integer NOT NULL,
	"avg_speed_kmh" real NOT NULL,
	"prep_time_minutes" real NOT NULL,
	"buffer_minutes" real NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"is_deleted" boolean DEFAULT false NOT NULL,
	"last_synced_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ordering_menu_item_snapshots" (
	"menu_item_id" uuid PRIMARY KEY NOT NULL,
	"restaurant_id" uuid NOT NULL,
	"name" text NOT NULL,
	"price" integer NOT NULL,
	"status" "ordering_menu_item_status" DEFAULT 'available' NOT NULL,
	"modifiers" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"last_synced_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ordering_restaurant_snapshots" (
	"restaurant_id" uuid PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"is_open" boolean DEFAULT false NOT NULL,
	"is_approved" boolean DEFAULT false NOT NULL,
	"address" text NOT NULL,
	"cuisine_type" text,
	"latitude" real,
	"longitude" real,
	"owner_id" uuid NOT NULL,
	"last_synced_at" timestamp DEFAULT now() NOT NULL
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
CREATE TABLE "outbox_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"event_type" text NOT NULL,
	"event_version" integer NOT NULL,
	"aggregate_id" uuid NOT NULL,
	"aggregate_version" integer DEFAULT 0 NOT NULL,
	"envelope" jsonb NOT NULL,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
	"published_at" timestamp with time zone,
	"attempt_count" integer DEFAULT 0 NOT NULL,
	"next_attempt_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "outbox_events_event_id_unique" UNIQUE("event_id")
);
--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_status_logs" ADD CONSTRAINT "order_status_logs_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ordering_delivery_zone_snapshots_restaurant_idx" ON "ordering_delivery_zone_snapshots" USING btree ("restaurant_id");--> statement-breakpoint
CREATE INDEX "idx_outbox_due" ON "outbox_events" USING btree ("published_at","next_attempt_at");--> statement-breakpoint
CREATE INDEX "idx_outbox_aggregate" ON "outbox_events" USING btree ("aggregate_id","aggregate_version");