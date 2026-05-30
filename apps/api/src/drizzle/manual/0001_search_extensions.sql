-- Manual ops migration: search extensions
--
-- Drizzle's schema diff (`db:push` / `db:migrate`) does NOT manage PostgreSQL
-- extensions, so they must be created out-of-band. The search module relies on:
--   * unaccent  — accent-insensitive ILIKE matching (e.g. "pho" matches "Phở")
--   * pg_trgm   — trigram GIN indexes that keep those ILIKE scans fast
--
-- Without `unaccent`, every text search throws
-- `function unaccent(text) does not exist` → HTTP 500.
--
-- The API also self-heals these at startup (see drizzle.bootstrap.ts), but run
-- this manually when provisioning a fresh database with a privileged role:
--
--   psql "$DATABASE_URL" -f src/drizzle/manual/0001_search_extensions.sql

CREATE EXTENSION IF NOT EXISTS unaccent WITH SCHEMA public;
CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA public;
