-- Proactive alerts are worded (and audited) in every language the bank supports, so a customer
-- reading the inbox in Arabic sees the Arabic card. Maps locale -> insight_event id.
ALTER TABLE "alert" ADD COLUMN "localeEventIds" JSONB NOT NULL DEFAULT '{}';
