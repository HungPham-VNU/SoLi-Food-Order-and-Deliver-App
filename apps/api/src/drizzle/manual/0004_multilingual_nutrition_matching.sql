-- Manual ops migration: multilingual nutrition matching
--
-- Adds language-independent source metadata to canonical nutrition foods and a
-- per-locale search surface for names and aliases.

ALTER TABLE "nutrition_foods"
  ADD COLUMN IF NOT EXISTS "source" text DEFAULT 'LEGACY' NOT NULL;

ALTER TABLE "nutrition_foods"
  ADD COLUMN IF NOT EXISTS "source_food_id" text;

CREATE INDEX IF NOT EXISTS "nutrition_foods_source_idx"
  ON "nutrition_foods" ("source");

CREATE INDEX IF NOT EXISTS "nutrition_foods_source_food_id_idx"
  ON "nutrition_foods" ("source_food_id");

CREATE UNIQUE INDEX IF NOT EXISTS "nutrition_foods_source_food_uidx"
  ON "nutrition_foods" ("source", "source_food_id")
  WHERE "source_food_id" IS NOT NULL;

CREATE TABLE IF NOT EXISTS "nutrition_food_localizations" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "nutrition_food_id" uuid NOT NULL
    REFERENCES "nutrition_foods"("id") ON DELETE cascade,
  "locale" text NOT NULL,
  "name" text NOT NULL,
  "aliases" text[] DEFAULT '{}'::text[] NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "nutrition_food_localizations_food_locale_uidx"
  ON "nutrition_food_localizations" ("nutrition_food_id", "locale");

CREATE INDEX IF NOT EXISTS "nutrition_food_localizations_food_idx"
  ON "nutrition_food_localizations" ("nutrition_food_id");

CREATE INDEX IF NOT EXISTS "nutrition_food_localizations_locale_idx"
  ON "nutrition_food_localizations" ("locale");

CREATE INDEX IF NOT EXISTS "nutrition_food_localizations_aliases_gin_idx"
  ON "nutrition_food_localizations" USING gin ("aliases");

CREATE INDEX IF NOT EXISTS "nutrition_food_localizations_name_trgm_idx"
  ON "nutrition_food_localizations" USING gin (lower("name") gin_trgm_ops);
