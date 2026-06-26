CREATE TYPE "public"."review_moderation_status" AS ENUM('visible', 'flagged', 'hidden');--> statement-breakpoint
CREATE TABLE "reviews" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"customer_id" uuid NOT NULL,
	"restaurant_id" uuid NOT NULL,
	"stars" smallint NOT NULL,
	"comment" text,
	"tags" text[],
	"moderation_status" "review_moderation_status" DEFAULT 'visible' NOT NULL,
	"moderation_reason" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "reviews_order_id_unique" UNIQUE("order_id"),
	CONSTRAINT "reviews_stars_check" CHECK ("reviews"."stars" BETWEEN 1 AND 5)
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
CREATE INDEX "reviews_restaurant_id_moderation_idx" ON "reviews" USING btree ("restaurant_id","moderation_status");--> statement-breakpoint
CREATE INDEX "reviews_customer_id_idx" ON "reviews" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "idx_review_outbox_due" ON "outbox_events" USING btree ("published_at","next_attempt_at");--> statement-breakpoint
CREATE INDEX "idx_review_outbox_aggregate" ON "outbox_events" USING btree ("aggregate_id","aggregate_version");
