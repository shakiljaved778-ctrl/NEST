-- The least-privilege role the API and worker connect as (docs/DEPLOYMENT.md, step 5).
-- Run once as the server admin (amiladmin), after the first migration:
--   psql "$ADMIN_URL" -v app_password="$APP_PASSWORD" -f infra/sql/amil_app_role.sql
-- The admin owns the schema and runs migrations; amil_app can read and write rows, nothing more:
-- no DDL, and the audit tables' triggers still reject UPDATE, DELETE and TRUNCATE for everyone.

CREATE ROLE amil_app LOGIN PASSWORD :'app_password';
GRANT CONNECT ON DATABASE amil TO amil_app;
GRANT USAGE ON SCHEMA public TO amil_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO amil_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO amil_app;

-- Tables and sequences that later migrations create.
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO amil_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO amil_app;
