CREATE EXTENSION IF NOT EXISTS vector;--> statement-breakpoint
CREATE EXTENSION IF NOT EXISTS unaccent;--> statement-breakpoint
CREATE EXTENSION IF NOT EXISTS pg_trgm;--> statement-breakpoint
CREATE TYPE "public"."menu_item_status" AS ENUM('available', 'unavailable', 'out_of_stock');--> statement-breakpoint
CREATE TYPE "public"."menu_item_nutrition_source" AS ENUM('AI_ESTIMATED', 'MANUALLY_ENTERED', 'VERIFIED_BY_RESTAURANT');--> statement-breakpoint
CREATE TYPE "public"."nutrition_analysis_status" AS ENUM('ANALYZED', 'NEEDS_REVIEW', 'CALCULATED', 'SAVED', 'FAILED');--> statement-breakpoint
CREATE TYPE "public"."nutrition_food_state" AS ENUM('raw', 'cooked', 'fried', 'boiled', 'grilled', 'unknown');--> statement-breakpoint
CREATE TYPE "public"."nutrition_input_type" AS ENUM('text', 'image');--> statement-breakpoint
CREATE TYPE "public"."dietary_tag_category" AS ENUM('dietary', 'lifestyle');--> statement-breakpoint
CREATE TYPE "public"."ai_search_embedding_job_status" AS ENUM('pending', 'processing', 'completed', 'failed');--> statement-breakpoint
CREATE TYPE "public"."ai_search_embedding_target_type" AS ENUM('menu_item', 'restaurant');--> statement-breakpoint
CREATE TABLE "delivery_zones" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"restaurant_id" uuid NOT NULL,
	"name" text NOT NULL,
	"radius_km" double precision NOT NULL,
	"base_fee" integer DEFAULT 0 NOT NULL,
	"per_km_rate" integer DEFAULT 0 NOT NULL,
	"avg_speed_kmh" real DEFAULT 30 NOT NULL,
	"prep_time_minutes" real DEFAULT 15 NOT NULL,
	"buffer_minutes" real DEFAULT 5 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "restaurants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"search_document" text,
	"search_content_hash" text,
	"embedding" vector(768),
	"embedding_model" text,
	"embedding_version" text,
	"embedding_generated_at" timestamp,
	"address" text NOT NULL,
	"phone" text NOT NULL,
	"is_open" boolean DEFAULT false NOT NULL,
	"is_approved" boolean DEFAULT false NOT NULL,
	"latitude" double precision,
	"longitude" double precision,
	"cuisine_type" text,
	"logo_url" text,
	"cover_image_url" text,
	"average_rating" real DEFAULT 0 NOT NULL,
	"rating_sum" integer DEFAULT 0 NOT NULL,
	"review_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "menu_categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"restaurant_id" uuid NOT NULL,
	"name" text NOT NULL,
	"display_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "menu_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"restaurant_id" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"search_document" text,
	"search_content_hash" text,
	"embedding" vector(768),
	"embedding_model" text,
	"embedding_version" text,
	"embedding_generated_at" timestamp,
	"price" integer NOT NULL,
	"sku" text,
	"category_id" uuid,
	"status" "menu_item_status" DEFAULT 'available' NOT NULL,
	"image_url" text,
	"tags" text[],
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "modifier_groups" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"menu_item_id" uuid NOT NULL,
	"name" text NOT NULL,
	"min_selections" integer DEFAULT 0 NOT NULL,
	"max_selections" integer DEFAULT 1 NOT NULL,
	"display_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "modifier_options" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"group_id" uuid NOT NULL,
	"name" text NOT NULL,
	"price" integer DEFAULT 0 NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"display_order" integer DEFAULT 0 NOT NULL,
	"is_available" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
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
CREATE TABLE "nutrition_food_localizations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"nutrition_food_id" uuid NOT NULL,
	"locale" text NOT NULL,
	"name" text NOT NULL,
	"aliases" text[] DEFAULT '{}'::text[] NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "nutrition_foods" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name_vi" text NOT NULL,
	"name_en" text NOT NULL,
	"source" text DEFAULT 'CUSTOM' NOT NULL,
	"source_food_id" text,
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
CREATE TABLE "nutrition_ingredient_aliases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"locale" text NOT NULL,
	"original_name" text NOT NULL,
	"normalized_name" text NOT NULL,
	"english_name" text NOT NULL,
	"nutrition_food_id" uuid,
	"confidence" real DEFAULT 0 NOT NULL,
	"created_by" text DEFAULT 'SYSTEM' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "dietary_tags" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(80) NOT NULL,
	"slug" varchar(80) NOT NULL,
	"description" text,
	"category" "dietary_tag_category" NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_search_embedding_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"target_type" "ai_search_embedding_target_type" NOT NULL,
	"target_id" uuid NOT NULL,
	"content_hash" text NOT NULL,
	"status" "ai_search_embedding_job_status" DEFAULT 'pending' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"available_at" timestamp DEFAULT now() NOT NULL,
	"locked_at" timestamp,
	"last_error" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_search_item_ranking_stats" (
	"menu_item_id" uuid PRIMARY KEY NOT NULL,
	"restaurant_id" uuid NOT NULL,
	"delivered_order_count_30d" integer DEFAULT 0 NOT NULL,
	"delivered_order_count_90d" integer DEFAULT 0 NOT NULL,
	"ordered_quantity_30d" integer DEFAULT 0 NOT NULL,
	"ordered_quantity_90d" integer DEFAULT 0 NOT NULL,
	"last_ordered_at" timestamp,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_search_restaurant_ranking_stats" (
	"restaurant_id" uuid PRIMARY KEY NOT NULL,
	"delivered_order_count_30d" integer DEFAULT 0 NOT NULL,
	"delivered_order_count_90d" integer DEFAULT 0 NOT NULL,
	"ordered_quantity_30d" integer DEFAULT 0 NOT NULL,
	"ordered_quantity_90d" integer DEFAULT 0 NOT NULL,
	"last_ordered_at" timestamp,
	"updated_at" timestamp DEFAULT now() NOT NULL
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
ALTER TABLE "delivery_zones" ADD CONSTRAINT "delivery_zones_restaurant_id_restaurants_id_fk" FOREIGN KEY ("restaurant_id") REFERENCES "public"."restaurants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "menu_categories" ADD CONSTRAINT "menu_categories_restaurant_id_restaurants_id_fk" FOREIGN KEY ("restaurant_id") REFERENCES "public"."restaurants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "menu_items" ADD CONSTRAINT "menu_items_restaurant_id_restaurants_id_fk" FOREIGN KEY ("restaurant_id") REFERENCES "public"."restaurants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "menu_items" ADD CONSTRAINT "menu_items_category_id_menu_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."menu_categories"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "modifier_groups" ADD CONSTRAINT "modifier_groups_menu_item_id_menu_items_id_fk" FOREIGN KEY ("menu_item_id") REFERENCES "public"."menu_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "modifier_options" ADD CONSTRAINT "modifier_options_group_id_modifier_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."modifier_groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "menu_item_nutrition" ADD CONSTRAINT "menu_item_nutrition_menu_item_id_menu_items_id_fk" FOREIGN KEY ("menu_item_id") REFERENCES "public"."menu_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "nutrition_analysis_ingredients" ADD CONSTRAINT "nutrition_analysis_ingredients_analysis_session_id_nutrition_analysis_sessions_id_fk" FOREIGN KEY ("analysis_session_id") REFERENCES "public"."nutrition_analysis_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "nutrition_analysis_ingredients" ADD CONSTRAINT "nutrition_analysis_ingredients_matched_nutrition_food_id_nutrition_foods_id_fk" FOREIGN KEY ("matched_nutrition_food_id") REFERENCES "public"."nutrition_foods"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "nutrition_analysis_sessions" ADD CONSTRAINT "nutrition_analysis_sessions_menu_item_id_menu_items_id_fk" FOREIGN KEY ("menu_item_id") REFERENCES "public"."menu_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "nutrition_analysis_sessions" ADD CONSTRAINT "nutrition_analysis_sessions_restaurant_id_restaurants_id_fk" FOREIGN KEY ("restaurant_id") REFERENCES "public"."restaurants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "nutrition_food_localizations" ADD CONSTRAINT "nutrition_food_localizations_nutrition_food_id_nutrition_foods_id_fk" FOREIGN KEY ("nutrition_food_id") REFERENCES "public"."nutrition_foods"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "nutrition_ingredient_aliases" ADD CONSTRAINT "nutrition_ingredient_aliases_nutrition_food_id_nutrition_foods_id_fk" FOREIGN KEY ("nutrition_food_id") REFERENCES "public"."nutrition_foods"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "restaurants_approved_open_idx" ON "restaurants" USING btree ("is_approved","is_open");--> statement-breakpoint
CREATE INDEX "restaurants_rating_idx" ON "restaurants" USING btree ("average_rating","review_count");--> statement-breakpoint
CREATE UNIQUE INDEX "menu_categories_restaurant_name_uidx" ON "menu_categories" USING btree ("restaurant_id","name");--> statement-breakpoint
CREATE INDEX "menu_items_price_idx" ON "menu_items" USING btree ("price");--> statement-breakpoint
CREATE INDEX "menu_items_tags_gin_idx" ON "menu_items" USING gin ("tags");--> statement-breakpoint
CREATE UNIQUE INDEX "menu_item_nutrition_menu_item_uidx" ON "menu_item_nutrition" USING btree ("menu_item_id");--> statement-breakpoint
CREATE INDEX "menu_item_nutrition_protein_idx" ON "menu_item_nutrition" USING btree ("protein");--> statement-breakpoint
CREATE INDEX "menu_item_nutrition_calories_idx" ON "menu_item_nutrition" USING btree ("calories");--> statement-breakpoint
CREATE INDEX "nutrition_analysis_ingredients_session_idx" ON "nutrition_analysis_ingredients" USING btree ("analysis_session_id");--> statement-breakpoint
CREATE INDEX "nutrition_analysis_ingredients_food_idx" ON "nutrition_analysis_ingredients" USING btree ("matched_nutrition_food_id");--> statement-breakpoint
CREATE INDEX "nutrition_sessions_menu_item_idx" ON "nutrition_analysis_sessions" USING btree ("menu_item_id");--> statement-breakpoint
CREATE INDEX "nutrition_sessions_restaurant_idx" ON "nutrition_analysis_sessions" USING btree ("restaurant_id");--> statement-breakpoint
CREATE UNIQUE INDEX "nutrition_food_localizations_food_locale_uidx" ON "nutrition_food_localizations" USING btree ("nutrition_food_id","locale");--> statement-breakpoint
CREATE INDEX "nutrition_food_localizations_food_idx" ON "nutrition_food_localizations" USING btree ("nutrition_food_id");--> statement-breakpoint
CREATE INDEX "nutrition_food_localizations_locale_idx" ON "nutrition_food_localizations" USING btree ("locale");--> statement-breakpoint
CREATE INDEX "nutrition_food_localizations_aliases_gin_idx" ON "nutrition_food_localizations" USING gin ("aliases");--> statement-breakpoint
CREATE UNIQUE INDEX "nutrition_foods_name_state_uidx" ON "nutrition_foods" USING btree ("name_vi","state");--> statement-breakpoint
CREATE INDEX "nutrition_foods_aliases_gin_idx" ON "nutrition_foods" USING gin ("aliases");--> statement-breakpoint
CREATE INDEX "nutrition_foods_name_vi_idx" ON "nutrition_foods" USING btree ("name_vi");--> statement-breakpoint
CREATE INDEX "nutrition_foods_source_idx" ON "nutrition_foods" USING btree ("source");--> statement-breakpoint
CREATE INDEX "nutrition_foods_source_food_id_idx" ON "nutrition_foods" USING btree ("source_food_id");--> statement-breakpoint
CREATE INDEX "nutrition_foods_state_idx" ON "nutrition_foods" USING btree ("state");--> statement-breakpoint
CREATE UNIQUE INDEX "nutrition_ingredient_aliases_locale_normalized_uidx" ON "nutrition_ingredient_aliases" USING btree ("locale","normalized_name");--> statement-breakpoint
CREATE INDEX "nutrition_ingredient_aliases_food_idx" ON "nutrition_ingredient_aliases" USING btree ("nutrition_food_id");--> statement-breakpoint
CREATE INDEX "nutrition_ingredient_aliases_english_name_idx" ON "nutrition_ingredient_aliases" USING btree ("english_name");--> statement-breakpoint
CREATE UNIQUE INDEX "dietary_tags_slug_unique" ON "dietary_tags" USING btree ("slug");--> statement-breakpoint
CREATE UNIQUE INDEX "dietary_tags_name_lower_unique" ON "dietary_tags" USING btree (lower("name"));--> statement-breakpoint
CREATE INDEX "dietary_tags_active_category_idx" ON "dietary_tags" USING btree ("is_active","category");--> statement-breakpoint
CREATE UNIQUE INDEX "ai_search_embedding_jobs_target_uidx" ON "ai_search_embedding_jobs" USING btree ("target_type","target_id");--> statement-breakpoint
CREATE INDEX "ai_search_embedding_jobs_status_available_idx" ON "ai_search_embedding_jobs" USING btree ("status","available_at");--> statement-breakpoint
CREATE INDEX "ai_search_item_ranking_stats_restaurant_idx" ON "ai_search_item_ranking_stats" USING btree ("restaurant_id");--> statement-breakpoint
CREATE INDEX "ai_search_item_ranking_stats_updated_idx" ON "ai_search_item_ranking_stats" USING btree ("updated_at");--> statement-breakpoint
CREATE INDEX "ai_search_restaurant_ranking_stats_updated_idx" ON "ai_search_restaurant_ranking_stats" USING btree ("updated_at");--> statement-breakpoint
CREATE INDEX "idx_outbox_due" ON "outbox_events" USING btree ("published_at","next_attempt_at");--> statement-breakpoint
CREATE INDEX "idx_outbox_aggregate" ON "outbox_events" USING btree ("aggregate_id","aggregate_version");--> statement-breakpoint
-- AI search hybrid retrieval indexes (expression + pgvector HNSW). drizzle-kit
-- cannot express these, so they are appended to the initial migration.
CREATE INDEX IF NOT EXISTS "menu_items_search_document_fts_idx" ON "menu_items" USING gin (to_tsvector('simple', search_document));--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "restaurants_search_document_fts_idx" ON "restaurants" USING gin (to_tsvector('simple', search_document));--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "menu_items_search_document_trgm_idx" ON "menu_items" USING gin (search_document gin_trgm_ops);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "restaurants_search_document_trgm_idx" ON "restaurants" USING gin (search_document gin_trgm_ops);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "menu_items_embedding_hnsw_idx" ON "menu_items" USING hnsw (embedding vector_cosine_ops);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "restaurants_embedding_hnsw_idx" ON "restaurants" USING hnsw (embedding vector_cosine_ops);
