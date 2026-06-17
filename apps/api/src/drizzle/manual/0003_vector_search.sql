-- Migration: 0003_vector_search.sql

-- 1. Enable pgvector extension (same pattern as unaccent/pg_trgm)
CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA public;

-- 2. Add embedding columns to menu_items and restaurants
ALTER TABLE menu_items
  ADD COLUMN IF NOT EXISTS search_document TEXT,
  ADD COLUMN IF NOT EXISTS embedding vector(768);

ALTER TABLE restaurants
  ADD COLUMN IF NOT EXISTS search_document TEXT,
  ADD COLUMN IF NOT EXISTS embedding vector(768);

-- 3. Create HNSW indexes for approximate nearest neighbor search
-- m=16, ef_construction=64 are good defaults for <100k vectors
CREATE INDEX IF NOT EXISTS menu_items_embedding_hnsw_idx
  ON menu_items USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

CREATE INDEX IF NOT EXISTS restaurants_embedding_hnsw_idx
  ON restaurants USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);
