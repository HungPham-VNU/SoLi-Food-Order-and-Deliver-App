-- Automatically create the dedicated E2E / integration-test database
-- when the PostgreSQL container is first initialised.
--
-- This script runs once via /docker-entrypoint-initdb.d/ and is idempotent:
-- the SELECT guard prevents an error if the database already exists.

SELECT 'CREATE DATABASE uitfoodms_test'
WHERE NOT EXISTS (
    SELECT FROM pg_database WHERE datname = 'uitfoodms_test'
)\gexec

-- Use a non-superuser credential for the legacy API in local Compose so the
-- Media database isolation can be exercised rather than bypassed by Postgres.
SELECT 'CREATE ROLE uitfood_api LOGIN PASSWORD ''api_secret'''
WHERE NOT EXISTS (
    SELECT FROM pg_roles WHERE rolname = 'uitfood_api'
)\gexec

SELECT format('GRANT CONNECT ON DATABASE %I TO uitfood_api', current_database())\gexec
GRANT USAGE, CREATE ON SCHEMA public TO uitfood_api;

-- Phase 3: a separate logical database and credential for the Media service.
-- The legacy API credential is deliberately not granted access.
SELECT 'CREATE ROLE uitfood_media LOGIN PASSWORD ''media_secret'''
WHERE NOT EXISTS (
    SELECT FROM pg_roles WHERE rolname = 'uitfood_media'
)\gexec

SELECT 'CREATE DATABASE uitfood_media OWNER uitfood_media'
WHERE NOT EXISTS (
    SELECT FROM pg_database WHERE datname = 'uitfood_media'
)\gexec

REVOKE ALL ON DATABASE uitfood_media FROM PUBLIC;
GRANT CONNECT, TEMPORARY ON DATABASE uitfood_media TO uitfood_media;

-- Phase 4: a separate logical database and credential for the Identity service.
-- The legacy API credential is deliberately not granted access.
SELECT 'CREATE ROLE uitfood_identity LOGIN PASSWORD ''identity_secret'''
WHERE NOT EXISTS (
    SELECT FROM pg_roles WHERE rolname = 'uitfood_identity'
)\gexec

SELECT 'CREATE DATABASE uitfood_identity OWNER uitfood_identity'
WHERE NOT EXISTS (
    SELECT FROM pg_database WHERE datname = 'uitfood_identity'
)\gexec

REVOKE ALL ON DATABASE uitfood_identity FROM PUBLIC;
GRANT CONNECT, TEMPORARY ON DATABASE uitfood_identity TO uitfood_identity;

-- Phase 5: a separate logical database and credential for the Notification service.
-- The legacy API credential is deliberately not granted access.
SELECT 'CREATE ROLE uitfood_notification LOGIN PASSWORD ''notification_secret'''
WHERE NOT EXISTS (
    SELECT FROM pg_roles WHERE rolname = 'uitfood_notification'
)\gexec

SELECT 'CREATE DATABASE uitfood_notification OWNER uitfood_notification'
WHERE NOT EXISTS (
    SELECT FROM pg_database WHERE datname = 'uitfood_notification'
)\gexec

REVOKE ALL ON DATABASE uitfood_notification FROM PUBLIC;
GRANT CONNECT, TEMPORARY ON DATABASE uitfood_notification TO uitfood_notification;

-- Phase 6: a separate logical database and credential for the Catalog service.
-- The legacy API credential is deliberately not granted access.
SELECT 'CREATE ROLE uitfood_catalog LOGIN PASSWORD ''catalog_secret'''
WHERE NOT EXISTS (
    SELECT FROM pg_roles WHERE rolname = 'uitfood_catalog'
)\gexec

SELECT 'CREATE DATABASE uitfood_catalog OWNER uitfood_catalog'
WHERE NOT EXISTS (
    SELECT FROM pg_database WHERE datname = 'uitfood_catalog'
)\gexec

REVOKE ALL ON DATABASE uitfood_catalog FROM PUBLIC;
GRANT CONNECT, TEMPORARY ON DATABASE uitfood_catalog TO uitfood_catalog;

-- Grant the default Compose user full access to the test database.
SELECT format('GRANT ALL PRIVILEGES ON DATABASE %I TO %I', 'uitfoodms_test', current_user)\gexec

-- Install extensions that search and semantic search require in the main DB.
CREATE EXTENSION IF NOT EXISTS unaccent  WITH SCHEMA public;
CREATE EXTENSION IF NOT EXISTS pg_trgm   WITH SCHEMA public;
CREATE EXTENSION IF NOT EXISTS vector    WITH SCHEMA public;

-- \connect switches context so the extensions are also created inside the test DB.
\connect uitfoodms_test

CREATE EXTENSION IF NOT EXISTS unaccent  WITH SCHEMA public;
CREATE EXTENSION IF NOT EXISTS pg_trgm   WITH SCHEMA public;
CREATE EXTENSION IF NOT EXISTS vector    WITH SCHEMA public;

-- The Catalog DB owns the restaurant/menu search + semantic-search tables, so it
-- needs the same extensions installed inside its own database before migrations.
\connect uitfood_catalog

CREATE EXTENSION IF NOT EXISTS unaccent  WITH SCHEMA public;
CREATE EXTENSION IF NOT EXISTS pg_trgm   WITH SCHEMA public;
CREATE EXTENSION IF NOT EXISTS vector    WITH SCHEMA public;
