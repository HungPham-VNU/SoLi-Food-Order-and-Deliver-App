-- Manual ops migration: canonical ingredient alias cache
--
-- Caches multilingual ingredient names to English canonical names and, when
-- known, the resolved nutrition food row.

CREATE TABLE IF NOT EXISTS "nutrition_ingredient_aliases" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "locale" text NOT NULL,
  "original_name" text NOT NULL,
  "normalized_name" text NOT NULL,
  "english_name" text NOT NULL,
  "nutrition_food_id" uuid
    REFERENCES "nutrition_foods"("id") ON DELETE set null,
  "confidence" real DEFAULT 0 NOT NULL,
  "created_by" text DEFAULT 'SYSTEM' NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "nutrition_ingredient_aliases_locale_normalized_uidx"
  ON "nutrition_ingredient_aliases" ("locale", "normalized_name");

CREATE INDEX IF NOT EXISTS "nutrition_ingredient_aliases_food_idx"
  ON "nutrition_ingredient_aliases" ("nutrition_food_id");

CREATE INDEX IF NOT EXISTS "nutrition_ingredient_aliases_english_name_idx"
  ON "nutrition_ingredient_aliases" ("english_name");
