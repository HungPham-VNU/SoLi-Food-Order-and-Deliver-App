-- Automatically create the dedicated E2E / integration-test database
-- when the PostgreSQL container is first initialised.
--
-- This script runs once via /docker-entrypoint-initdb.d/ and is idempotent:
-- the SELECT guard prevents an error if the database already exists.

SELECT 'CREATE DATABASE uitfoodms_test'
WHERE NOT EXISTS (
    SELECT FROM pg_database WHERE datname = 'uitfoodms_test'
)\gexec

-- Service-owned logical databases and credentials.
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

SELECT 'CREATE ROLE uitfood_promotion LOGIN PASSWORD ''promotion_secret'''
WHERE NOT EXISTS (
    SELECT FROM pg_roles WHERE rolname = 'uitfood_promotion'
)\gexec

SELECT 'CREATE DATABASE uitfood_promotion OWNER uitfood_promotion'
WHERE NOT EXISTS (
    SELECT FROM pg_database WHERE datname = 'uitfood_promotion'
)\gexec

REVOKE ALL ON DATABASE uitfood_promotion FROM PUBLIC;
GRANT CONNECT, TEMPORARY ON DATABASE uitfood_promotion TO uitfood_promotion;

SELECT 'CREATE ROLE uitfood_payment LOGIN PASSWORD ''payment_secret'''
WHERE NOT EXISTS (
    SELECT FROM pg_roles WHERE rolname = 'uitfood_payment'
)\gexec

SELECT 'CREATE DATABASE uitfood_payment OWNER uitfood_payment'
WHERE NOT EXISTS (
    SELECT FROM pg_database WHERE datname = 'uitfood_payment'
)\gexec

REVOKE ALL ON DATABASE uitfood_payment FROM PUBLIC;
GRANT CONNECT, TEMPORARY ON DATABASE uitfood_payment TO uitfood_payment;

SELECT 'CREATE ROLE uitfood_review LOGIN PASSWORD ''review_secret'''
WHERE NOT EXISTS (
    SELECT FROM pg_roles WHERE rolname = 'uitfood_review'
)\gexec

SELECT 'CREATE DATABASE uitfood_review OWNER uitfood_review'
WHERE NOT EXISTS (
    SELECT FROM pg_database WHERE datname = 'uitfood_review'
)\gexec

REVOKE ALL ON DATABASE uitfood_review FROM PUBLIC;
GRANT CONNECT, TEMPORARY ON DATABASE uitfood_review TO uitfood_review;

SELECT 'CREATE ROLE uitfood_ordering LOGIN PASSWORD ''ordering_secret'''
WHERE NOT EXISTS (
    SELECT FROM pg_roles WHERE rolname = 'uitfood_ordering'
)\gexec

SELECT 'CREATE DATABASE uitfood_ordering OWNER uitfood_ordering'
WHERE NOT EXISTS (
    SELECT FROM pg_database WHERE datname = 'uitfood_ordering'
)\gexec

REVOKE ALL ON DATABASE uitfood_ordering FROM PUBLIC;
GRANT CONNECT, TEMPORARY ON DATABASE uitfood_ordering TO uitfood_ordering;

SELECT 'CREATE ROLE uitfood_reporting LOGIN PASSWORD ''reporting_secret'''
WHERE NOT EXISTS (
    SELECT FROM pg_roles WHERE rolname = 'uitfood_reporting'
)\gexec

SELECT 'CREATE DATABASE uitfood_reporting OWNER uitfood_reporting'
WHERE NOT EXISTS (
    SELECT FROM pg_database WHERE datname = 'uitfood_reporting'
)\gexec

REVOKE ALL ON DATABASE uitfood_reporting FROM PUBLIC;
GRANT CONNECT, TEMPORARY ON DATABASE uitfood_reporting TO uitfood_reporting;

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
