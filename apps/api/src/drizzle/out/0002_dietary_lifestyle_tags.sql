CREATE TYPE "public"."dietary_tag_category" AS ENUM('dietary', 'lifestyle');--> statement-breakpoint
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
CREATE UNIQUE INDEX "dietary_tags_slug_unique" ON "dietary_tags" USING btree ("slug");--> statement-breakpoint
CREATE UNIQUE INDEX "dietary_tags_name_lower_unique" ON "dietary_tags" USING btree (lower("name"));--> statement-breakpoint
CREATE INDEX "dietary_tags_active_category_idx" ON "dietary_tags" USING btree ("is_active","category");--> statement-breakpoint
INSERT INTO "dietary_tags" ("name", "slug", "description", "category") VALUES
	('Vegan', 'vegan', 'Contains no animal-derived ingredients.', 'dietary'),
	('Gluten-Free', 'gluten-free', 'Contains no gluten-bearing ingredients.', 'dietary'),
	('Organic', 'organic', 'Made primarily with certified organic ingredients.', 'lifestyle'),
	('Locally Sourced', 'locally-sourced', 'Highlights ingredients sourced from local producers.', 'lifestyle'),
	('Sugar-Free', 'sugar-free', 'Contains no added sugar.', 'dietary')
ON CONFLICT ("slug") DO NOTHING;
