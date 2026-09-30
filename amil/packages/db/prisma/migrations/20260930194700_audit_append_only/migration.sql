-- Non-negotiable 7: audit tables are append-only.
--
-- UPDATE, DELETE and TRUNCATE on insight_event and customer_response are rejected at the
-- database level, whatever the application code does. The single exception is the retention
-- purge (docs/DECISIONS.md D-005): a DELETE is allowed only inside a transaction that has run
--   SET LOCAL amil.audit_purge = 'on'
-- and only for rows whose retention period has expired.

-- Separate functions per table: PL/pgSQL plans each expression against the row type, so a
-- shared function cannot reference columns that only one of the tables has.
CREATE OR REPLACE FUNCTION amil_insight_event_append_only() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE'
     AND current_setting('amil.audit_purge', true) = 'on'
     AND OLD."retentionUntil" < now() THEN
    RETURN OLD;
  END IF;
  RAISE EXCEPTION 'AMIL audit table "%" is append-only: % rejected', TG_TABLE_NAME, TG_OP
    USING ERRCODE = 'insufficient_privilege';
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION amil_customer_response_append_only() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' AND current_setting('amil.audit_purge', true) = 'on' THEN
    IF EXISTS (
      SELECT 1 FROM "insight_event" e
      WHERE e."id" = OLD."insightEventId" AND e."retentionUntil" < now()
    ) THEN
      RETURN OLD;
    END IF;
  END IF;
  RAISE EXCEPTION 'AMIL audit table "%" is append-only: % rejected', TG_TABLE_NAME, TG_OP
    USING ERRCODE = 'insufficient_privilege';
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION amil_audit_no_truncate() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'AMIL audit table "%" is append-only: TRUNCATE rejected', TG_TABLE_NAME
    USING ERRCODE = 'insufficient_privilege';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER insight_event_append_only
  BEFORE UPDATE OR DELETE ON "insight_event"
  FOR EACH ROW EXECUTE FUNCTION amil_insight_event_append_only();

CREATE TRIGGER insight_event_no_truncate
  BEFORE TRUNCATE ON "insight_event"
  FOR EACH STATEMENT EXECUTE FUNCTION amil_audit_no_truncate();

CREATE TRIGGER customer_response_append_only
  BEFORE UPDATE OR DELETE ON "customer_response"
  FOR EACH ROW EXECUTE FUNCTION amil_customer_response_append_only();

CREATE TRIGGER customer_response_no_truncate
  BEFORE TRUNCATE ON "customer_response"
  FOR EACH STATEMENT EXECUTE FUNCTION amil_audit_no_truncate();
