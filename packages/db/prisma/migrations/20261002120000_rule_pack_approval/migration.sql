-- Pack parameter changes need compliance approval (D-074): a proposed version waits as
-- pending_approval and is never served; compliance approves (active) or rejects it.
ALTER TYPE "RulePackStatus" ADD VALUE 'pending_approval' AFTER 'draft';
ALTER TYPE "RulePackStatus" ADD VALUE 'rejected' AFTER 'active';

ALTER TABLE "rule_pack" ADD COLUMN "approvedAt" TIMESTAMP(3),
ADD COLUMN "approvedBy" TEXT;
