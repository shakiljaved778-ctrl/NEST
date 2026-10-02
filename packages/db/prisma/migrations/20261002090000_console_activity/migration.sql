-- CreateTable
CREATE TABLE "console_activity" (
    "id" TEXT NOT NULL,
    "bankId" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "detail" JSONB,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "console_activity_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "console_activity_bankId_at_idx" ON "console_activity"("bankId", "at");

-- AddForeignKey
ALTER TABLE "console_activity" ADD CONSTRAINT "console_activity_bankId_fkey" FOREIGN KEY ("bankId") REFERENCES "bank"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "console_activity" ADD CONSTRAINT "console_activity_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "console_user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Console records are append-only too (D-068): the approval log (every change made in the
-- console) and the activity log (sign-ins, customer-level reads and exports).
CREATE OR REPLACE FUNCTION amil_console_log_append_only() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'AMIL console log "%" is append-only: % rejected', TG_TABLE_NAME, TG_OP
    USING ERRCODE = 'insufficient_privilege';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER approval_log_append_only
  BEFORE UPDATE OR DELETE ON "approval_log"
  FOR EACH ROW EXECUTE FUNCTION amil_console_log_append_only();

CREATE TRIGGER approval_log_no_truncate
  BEFORE TRUNCATE ON "approval_log"
  FOR EACH STATEMENT EXECUTE FUNCTION amil_console_log_append_only();

CREATE TRIGGER console_activity_append_only
  BEFORE UPDATE OR DELETE ON "console_activity"
  FOR EACH ROW EXECUTE FUNCTION amil_console_log_append_only();

CREATE TRIGGER console_activity_no_truncate
  BEFORE TRUNCATE ON "console_activity"
  FOR EACH STATEMENT EXECUTE FUNCTION amil_console_log_append_only();
