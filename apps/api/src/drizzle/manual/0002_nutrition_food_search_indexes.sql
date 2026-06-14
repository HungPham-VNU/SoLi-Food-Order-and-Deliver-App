-- Manual ops migration: nutrition food candidate search indexes
--
-- The nutrition matcher first asks PostgreSQL for a small candidate set, then
-- reranks those rows in TypeScript. These indexes keep the database-side
-- retrieval path fast as the nutrition_foods table grows.
--
-- Drizzle schema diff does not manage extension-dependent expression indexes
-- reliably across all environments, so apply this manually during database
-- provisioning after 0001_search_extensions.sql.

CREATE INDEX IF NOT EXISTS nutrition_foods_name_vi_trgm_idx
  ON nutrition_foods USING gin (lower(name_vi) gin_trgm_ops);

CREATE INDEX IF NOT EXISTS nutrition_foods_name_en_trgm_idx
  ON nutrition_foods USING gin (lower(name_en) gin_trgm_ops);

CREATE INDEX IF NOT EXISTS nutrition_foods_search_text_fts_idx
  ON nutrition_foods USING gin (
    to_tsvector(
      'simple',
      name_vi || ' ' || name_en || ' ' || COALESCE(category, '')
    )
  );
