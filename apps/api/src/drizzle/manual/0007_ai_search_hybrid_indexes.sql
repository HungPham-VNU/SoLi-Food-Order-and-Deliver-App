-- Manual ops migration: AI search hybrid retrieval indexes.
--
-- Drizzle schema diff does not reliably manage extension-backed expression
-- indexes or pgvector HNSW indexes across every environment. Apply this after
-- 0001_search_extensions.sql on provisioned databases.

CREATE EXTENSION IF NOT EXISTS unaccent WITH SCHEMA public;
CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA public;
CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA public;

ALTER TABLE menu_items
  ADD COLUMN IF NOT EXISTS search_content_hash TEXT,
  ADD COLUMN IF NOT EXISTS embedding_model TEXT,
  ADD COLUMN IF NOT EXISTS embedding_version TEXT,
  ADD COLUMN IF NOT EXISTS embedding_generated_at TIMESTAMP;

ALTER TABLE restaurants
  ADD COLUMN IF NOT EXISTS search_content_hash TEXT,
  ADD COLUMN IF NOT EXISTS embedding_model TEXT,
  ADD COLUMN IF NOT EXISTS embedding_version TEXT,
  ADD COLUMN IF NOT EXISTS embedding_generated_at TIMESTAMP;

DO $$
BEGIN
  CREATE TYPE ai_search_embedding_target_type AS ENUM ('menu_item', 'restaurant');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE ai_search_embedding_job_status AS ENUM ('pending', 'processing', 'completed', 'failed');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS ai_search_embedding_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  target_type ai_search_embedding_target_type NOT NULL,
  target_id UUID NOT NULL,
  content_hash TEXT NOT NULL,
  status ai_search_embedding_job_status NOT NULL DEFAULT 'pending',
  attempts INTEGER NOT NULL DEFAULT 0,
  available_at TIMESTAMP NOT NULL DEFAULT now(),
  locked_at TIMESTAMP,
  last_error TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  updated_at TIMESTAMP NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS ai_search_embedding_jobs_target_uidx
  ON ai_search_embedding_jobs (target_type, target_id);

CREATE INDEX IF NOT EXISTS ai_search_embedding_jobs_status_available_idx
  ON ai_search_embedding_jobs (status, available_at);

CREATE INDEX IF NOT EXISTS menu_items_search_document_fts_idx
  ON menu_items USING gin (to_tsvector('simple', search_document));

CREATE INDEX IF NOT EXISTS restaurants_search_document_fts_idx
  ON restaurants USING gin (to_tsvector('simple', search_document));

CREATE INDEX IF NOT EXISTS menu_items_search_document_trgm_idx
  ON menu_items USING gin (search_document gin_trgm_ops);

CREATE INDEX IF NOT EXISTS restaurants_search_document_trgm_idx
  ON restaurants USING gin (search_document gin_trgm_ops);

CREATE INDEX IF NOT EXISTS menu_items_embedding_hnsw_idx
  ON menu_items USING hnsw (embedding vector_cosine_ops);

CREATE INDEX IF NOT EXISTS restaurants_embedding_hnsw_idx
  ON restaurants USING hnsw (embedding vector_cosine_ops);
