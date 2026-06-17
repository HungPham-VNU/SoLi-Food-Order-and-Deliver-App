-- Automatically create the dedicated E2E / integration-test database
-- when the PostgreSQL container is first initialised.
--
-- This script runs once via /docker-entrypoint-initdb.d/ and is idempotent:
-- the SELECT guard prevents an error if the database already exists.

SELECT 'CREATE DATABASE food_order_test'
WHERE NOT EXISTS (
    SELECT FROM pg_database WHERE datname = 'food_order_test'
)\gexec

-- Grant the default user full access to the test database.
GRANT ALL PRIVILEGES ON DATABASE food_order_test TO food_order;

-- Install extensions that search and semantic search require in the main DB.
CREATE EXTENSION IF NOT EXISTS unaccent  WITH SCHEMA public;
CREATE EXTENSION IF NOT EXISTS pg_trgm   WITH SCHEMA public;
CREATE EXTENSION IF NOT EXISTS vector    WITH SCHEMA public;

-- \connect switches context so the extensions are also created inside the test DB.
\connect food_order_test

CREATE EXTENSION IF NOT EXISTS unaccent  WITH SCHEMA public;
CREATE EXTENSION IF NOT EXISTS pg_trgm   WITH SCHEMA public;
CREATE EXTENSION IF NOT EXISTS vector    WITH SCHEMA public;
