CREATE TYPE "public"."order_cancellation_reason" AS ENUM('kitchen_cancel', 'driver_no_show', 'out_of_stock', 'customer_request', 'payment_failed', 'timeout', 'other');--> statement-breakpoint
CREATE TYPE "public"."review_moderation_status" AS ENUM('visible', 'flagged', 'hidden');--> statement-breakpoint
CREATE TYPE "public"."menu_item_nutrition_source" AS ENUM('AI_ESTIMATED', 'MANUALLY_ENTERED', 'VERIFIED_BY_RESTAURANT');--> statement-breakpoint
CREATE TYPE "public"."nutrition_analysis_status" AS ENUM('ANALYZED', 'NEEDS_REVIEW', 'CALCULATED', 'SAVED', 'FAILED');--> statement-breakpoint
CREATE TYPE "public"."nutrition_food_state" AS ENUM('raw', 'cooked', 'fried', 'boiled', 'grilled', 'unknown');--> statement-breakpoint
CREATE TYPE "public"."nutrition_input_type" AS ENUM('text', 'image');--> statement-breakpoint
ALTER TYPE "public"."notification_type" ADD VALUE 'new_review' BEFORE 'pickup_request';--> statement-breakpoint
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
CREATE TABLE "menu_item_nutrition" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"menu_item_id" uuid NOT NULL,
	"servings" integer NOT NULL,
	"calories" real NOT NULL,
	"protein" real NOT NULL,
	"carbs" real NOT NULL,
	"fat" real NOT NULL,
	"fiber" real,
	"sugar" real,
	"sodium" real,
	"source" "menu_item_nutrition_source" DEFAULT 'AI_ESTIMATED' NOT NULL,
	"verified_by_restaurant" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "nutrition_analysis_ingredients" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"analysis_session_id" uuid NOT NULL,
	"raw_text" text,
	"extracted_name" text NOT NULL,
	"corrected_name" text,
	"quantity" real,
	"unit" text NOT NULL,
	"quantity_gram" real,
	"matched_nutrition_food_id" uuid,
	"confidence" real,
	"requires_confirmation" boolean DEFAULT false NOT NULL,
	"notes" text[] DEFAULT '{}'::text[] NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "nutrition_analysis_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"menu_item_id" uuid NOT NULL,
	"restaurant_id" uuid NOT NULL,
	"input_type" "nutrition_input_type" DEFAULT 'text' NOT NULL,
	"raw_recipe_text" text NOT NULL,
	"ai_extracted_json" jsonb,
	"status" "nutrition_analysis_status" NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "nutrition_foods" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name_vi" text NOT NULL,
	"name_en" text NOT NULL,
	"aliases" text[] DEFAULT '{}'::text[] NOT NULL,
	"category" text,
	"state" "nutrition_food_state" DEFAULT 'unknown' NOT NULL,
	"calories_100g" real NOT NULL,
	"protein_100g" real NOT NULL,
	"carbs_100g" real NOT NULL,
	"fat_100g" real NOT NULL,
	"fiber_100g" real,
	"sugar_100g" real,
	"sodium_100g" real,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "restaurants" ADD COLUMN "average_rating" real DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "restaurants" ADD COLUMN "rating_sum" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "restaurants" ADD COLUMN "review_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "order_status_logs" ADD COLUMN "cancellation_reason" "order_cancellation_reason";--> statement-breakpoint
ALTER TABLE "menu_item_nutrition" ADD CONSTRAINT "menu_item_nutrition_menu_item_id_menu_items_id_fk" FOREIGN KEY ("menu_item_id") REFERENCES "public"."menu_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "nutrition_analysis_ingredients" ADD CONSTRAINT "nutrition_analysis_ingredients_analysis_session_id_nutrition_analysis_sessions_id_fk" FOREIGN KEY ("analysis_session_id") REFERENCES "public"."nutrition_analysis_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "nutrition_analysis_ingredients" ADD CONSTRAINT "nutrition_analysis_ingredients_matched_nutrition_food_id_nutrition_foods_id_fk" FOREIGN KEY ("matched_nutrition_food_id") REFERENCES "public"."nutrition_foods"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "nutrition_analysis_sessions" ADD CONSTRAINT "nutrition_analysis_sessions_menu_item_id_menu_items_id_fk" FOREIGN KEY ("menu_item_id") REFERENCES "public"."menu_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "nutrition_analysis_sessions" ADD CONSTRAINT "nutrition_analysis_sessions_restaurant_id_restaurants_id_fk" FOREIGN KEY ("restaurant_id") REFERENCES "public"."restaurants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "reviews_restaurant_id_moderation_idx" ON "reviews" USING btree ("restaurant_id","moderation_status");--> statement-breakpoint
CREATE INDEX "reviews_customer_id_idx" ON "reviews" USING btree ("customer_id");--> statement-breakpoint
CREATE UNIQUE INDEX "menu_item_nutrition_menu_item_uidx" ON "menu_item_nutrition" USING btree ("menu_item_id");--> statement-breakpoint
CREATE INDEX "nutrition_analysis_ingredients_session_idx" ON "nutrition_analysis_ingredients" USING btree ("analysis_session_id");--> statement-breakpoint
CREATE INDEX "nutrition_analysis_ingredients_food_idx" ON "nutrition_analysis_ingredients" USING btree ("matched_nutrition_food_id");--> statement-breakpoint
CREATE INDEX "nutrition_sessions_menu_item_idx" ON "nutrition_analysis_sessions" USING btree ("menu_item_id");--> statement-breakpoint
CREATE INDEX "nutrition_sessions_restaurant_idx" ON "nutrition_analysis_sessions" USING btree ("restaurant_id");--> statement-breakpoint
CREATE UNIQUE INDEX "nutrition_foods_name_state_uidx" ON "nutrition_foods" USING btree ("name_vi","state");--> statement-breakpoint
CREATE INDEX "nutrition_foods_aliases_gin_idx" ON "nutrition_foods" USING gin ("aliases");--> statement-breakpoint
CREATE INDEX "nutrition_foods_name_vi_idx" ON "nutrition_foods" USING btree ("name_vi");--> statement-breakpoint
CREATE INDEX "nutrition_foods_state_idx" ON "nutrition_foods" USING btree ("state");