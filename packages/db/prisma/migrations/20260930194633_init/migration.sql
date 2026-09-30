-- CreateEnum
CREATE TYPE "Locale" AS ENUM ('en', 'ar');

-- CreateEnum
CREATE TYPE "DigitStyle" AS ENUM ('latn', 'arab');

-- CreateEnum
CREATE TYPE "ModelMode" AS ENUM ('redacted', 'in_country', 'off');

-- CreateEnum
CREATE TYPE "Variant" AS ENUM ('conventional', 'islamic');

-- CreateEnum
CREATE TYPE "AccountKind" AS ENUM ('current', 'savings');

-- CreateEnum
CREATE TYPE "AccountStatus" AS ENUM ('active', 'dormant', 'restricted', 'closed');

-- CreateEnum
CREATE TYPE "CardTier" AS ENUM ('classic', 'gold', 'platinum', 'signature');

-- CreateEnum
CREATE TYPE "CardStatus" AS ENUM ('active', 'blocked', 'closed');

-- CreateEnum
CREATE TYPE "FinanceType" AS ENUM ('conventional', 'murabaha', 'ijara');

-- CreateEnum
CREATE TYPE "ProductStatus" AS ENUM ('active', 'settled', 'closed');

-- CreateEnum
CREATE TYPE "DepositStatus" AS ENUM ('active', 'matured', 'broken');

-- CreateEnum
CREATE TYPE "TxnDirection" AS ENUM ('debit', 'credit');

-- CreateEnum
CREATE TYPE "TxnType" AS ENUM ('purchase', 'payment', 'fee', 'salary', 'transfer_in', 'transfer_out', 'cash_withdrawal', 'interest_charge', 'profit_charge', 'profit_credit', 'refund', 'standing_order', 'instalment');

-- CreateEnum
CREATE TYPE "RulePackStatus" AS ENUM ('draft', 'active', 'retired');

-- CreateEnum
CREATE TYPE "TemplateStatus" AS ENUM ('draft', 'approved', 'sharia_approved', 'retired');

-- CreateEnum
CREATE TYPE "Severity" AS ENUM ('info', 'caution', 'critical');

-- CreateEnum
CREATE TYPE "ValidatorResult" AS ENUM ('passed', 'rejected', 'not_used');

-- CreateEnum
CREATE TYPE "ResponseAction" AS ENUM ('continued', 'chose_option', 'talk_to_someone', 'dismissed');

-- CreateEnum
CREATE TYPE "ConsoleRole" AS ENUM ('admin', 'product', 'compliance', 'sharia', 'viewer');

-- CreateEnum
CREATE TYPE "ConsentMethod" AS ENUM ('in_app', 'online_banking', 'branch', 'api');

-- CreateTable
CREATE TABLE "bank" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameAr" TEXT NOT NULL,
    "defaultLocale" "Locale" NOT NULL DEFAULT 'en',
    "supportedLocales" "Locale"[],
    "brandTokens" JSONB NOT NULL,
    "deepLinkScheme" TEXT NOT NULL,
    "digitStyle" "DigitStyle" NOT NULL DEFAULT 'latn',
    "severityThresholds" JSONB NOT NULL,
    "modelMode" "ModelMode" NOT NULL DEFAULT 'redacted',
    "currency" TEXT NOT NULL DEFAULT 'QAR',
    "auditRetentionYears" INTEGER NOT NULL DEFAULT 10,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bank_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customer" (
    "id" TEXT NOT NULL,
    "bankId" TEXT NOT NULL,
    "externalRef" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "displayNameAr" TEXT NOT NULL,
    "phone" TEXT,
    "email" TEXT,
    "preferredLocale" "Locale" NOT NULL DEFAULT 'en',
    "segment" TEXT NOT NULL,
    "salaryTransfer" BOOLEAN NOT NULL DEFAULT false,
    "personaKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "customer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "consent" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "purpose" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "method" "ConsentMethod" NOT NULL,
    "grantedAt" TIMESTAMP(3) NOT NULL,
    "withdrawnAt" TIMESTAMP(3),
    "privacyPolicyVersion" TEXT NOT NULL,

    CONSTRAINT "consent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "account" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "kind" "AccountKind" NOT NULL,
    "variant" "Variant" NOT NULL DEFAULT 'conventional',
    "productName" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "iban" TEXT NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'QAR',
    "balance" DECIMAL(18,2) NOT NULL,
    "status" "AccountStatus" NOT NULL DEFAULT 'active',
    "isSalaryAccount" BOOLEAN NOT NULL DEFAULT false,
    "openedAt" TIMESTAMP(3) NOT NULL,
    "lastActivityAt" TIMESTAMP(3) NOT NULL,
    "dormancyDays" INTEGER NOT NULL DEFAULT 365,
    "closureFee" DECIMAL(18,2) NOT NULL,
    "chequesOutstanding" INTEGER NOT NULL DEFAULT 0,
    "maintenanceFee" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "maintenanceFeeWaived" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "standing_order" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "payee" TEXT NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "frequency" TEXT NOT NULL,
    "nextRunAt" TIMESTAMP(3) NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "standing_order_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "card" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "settlementAccountId" TEXT,
    "type" "Variant" NOT NULL,
    "tier" "CardTier" NOT NULL,
    "productName" TEXT NOT NULL,
    "pan" TEXT NOT NULL,
    "panLast4" TEXT NOT NULL,
    "creditLimit" DECIMAL(18,2) NOT NULL,
    "balance" DECIMAL(18,2) NOT NULL,
    "statementBalance" DECIMAL(18,2) NOT NULL,
    "minDue" DECIMAL(18,2) NOT NULL,
    "paymentDueAt" TIMESTAMP(3) NOT NULL,
    "profitOrInterestRateApr" DECIMAL(9,4) NOT NULL,
    "cashAdvanceFeePct" DECIMAL(9,4) NOT NULL,
    "cashAdvanceMinFee" DECIMAL(18,2) NOT NULL,
    "annualFee" DECIMAL(18,2) NOT NULL,
    "annualFeeChargedAt" TIMESTAMP(3),
    "annualFeeWaived" BOOLEAN NOT NULL DEFAULT false,
    "feeRefundRule" JSONB NOT NULL,
    "status" "CardStatus" NOT NULL DEFAULT 'active',
    "supplementaryCount" INTEGER NOT NULL DEFAULT 0,
    "openedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "card_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rewards_ledger" (
    "id" TEXT NOT NULL,
    "cardId" TEXT NOT NULL,
    "balance" INTEGER NOT NULL,
    "pointValueQar" DECIMAL(10,4) NOT NULL,
    "expiryBuckets" JSONB NOT NULL,
    "pendingCashback" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "asOf" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rewards_ledger_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "instalment_plan" (
    "id" TEXT NOT NULL,
    "cardId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "originalAmount" DECIMAL(18,2) NOT NULL,
    "principalRemaining" DECIMAL(18,2) NOT NULL,
    "monthsRemaining" INTEGER NOT NULL,
    "monthlyAmount" DECIMAL(18,2) NOT NULL,
    "earlyClosureFeeRule" JSONB NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "status" "ProductStatus" NOT NULL DEFAULT 'active',

    CONSTRAINT "instalment_plan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "finance" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "type" "FinanceType" NOT NULL,
    "productName" TEXT NOT NULL,
    "originalPrincipal" DECIMAL(18,2) NOT NULL,
    "principalOutstanding" DECIMAL(18,2) NOT NULL,
    "ratePct" DECIMAL(9,4) NOT NULL,
    "tenorMonths" INTEGER NOT NULL,
    "monthsElapsed" INTEGER NOT NULL,
    "instalment" DECIMAL(18,2) NOT NULL,
    "startAt" TIMESTAMP(3) NOT NULL,
    "nextInstalmentAt" TIMESTAMP(3) NOT NULL,
    "schedule" JSONB NOT NULL,
    "settlementFeeRule" JSONB NOT NULL,
    "rebateRule" JSONB,
    "insuranceOrTakaful" JSONB,
    "salaryLinked" BOOLEAN NOT NULL DEFAULT false,
    "status" "ProductStatus" NOT NULL DEFAULT 'active',

    CONSTRAINT "finance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "deposit" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "variant" "Variant" NOT NULL,
    "productName" TEXT NOT NULL,
    "principal" DECIMAL(18,2) NOT NULL,
    "ratePct" DECIMAL(9,4) NOT NULL,
    "startAt" TIMESTAMP(3) NOT NULL,
    "maturityAt" TIMESTAMP(3) NOT NULL,
    "breakPenaltyRule" JSONB NOT NULL,
    "profitOnBreakRule" JSONB NOT NULL,
    "payoutAccountId" TEXT,
    "autoRenew" BOOLEAN NOT NULL DEFAULT false,
    "status" "DepositStatus" NOT NULL DEFAULT 'active',

    CONSTRAINT "deposit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transaction" (
    "id" TEXT NOT NULL,
    "accountId" TEXT,
    "cardId" TEXT,
    "amount" DECIMAL(18,2) NOT NULL,
    "direction" "TxnDirection" NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'QAR',
    "type" "TxnType" NOT NULL,
    "merchant" TEXT,
    "category" TEXT,
    "postedAt" TIMESTAMP(3) NOT NULL,
    "feeCode" TEXT,

    CONSTRAINT "transaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fee_schedule" (
    "id" TEXT NOT NULL,
    "bankId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "nameEn" TEXT NOT NULL,
    "nameAr" TEXT NOT NULL,
    "descriptionEn" TEXT NOT NULL,
    "descriptionAr" TEXT NOT NULL,
    "avoidTipEn" TEXT NOT NULL,
    "avoidTipAr" TEXT NOT NULL,
    "amountRule" JSONB NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "effectiveFrom" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "fee_schedule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rule_pack" (
    "id" TEXT NOT NULL,
    "bankId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "variant" "Variant" NOT NULL,
    "productFamily" TEXT NOT NULL,
    "status" "RulePackStatus" NOT NULL DEFAULT 'draft',
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "parameters" JSONB NOT NULL,
    "effectiveFrom" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT,

    CONSTRAINT "rule_pack_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "template" (
    "id" TEXT NOT NULL,
    "bankId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "rulePackKey" TEXT NOT NULL,
    "variant" "Variant" NOT NULL,
    "locale" "Locale" NOT NULL,
    "severity" "Severity" NOT NULL,
    "headline" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "options" JSONB NOT NULL,
    "status" "TemplateStatus" NOT NULL DEFAULT 'draft',
    "version" INTEGER NOT NULL DEFAULT 1,
    "approvedBy" TEXT,
    "approvedAt" TIMESTAMP(3),
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "template_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "insight_event" (
    "id" TEXT NOT NULL,
    "seq" BIGSERIAL NOT NULL,
    "bankId" TEXT NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "trigger" TEXT NOT NULL,
    "customerRefHash" TEXT NOT NULL,
    "rulePackKey" TEXT NOT NULL,
    "rulePackVersion" TEXT NOT NULL,
    "variant" "Variant" NOT NULL,
    "inputSnapshotHash" TEXT NOT NULL,
    "applicable" BOOLEAN NOT NULL,
    "severity" "Severity",
    "facts" JSONB NOT NULL,
    "templateKey" TEXT,
    "templateVersion" INTEGER,
    "modelProvider" TEXT,
    "modelVersion" TEXT,
    "validatorResult" "ValidatorResult" NOT NULL,
    "locale" "Locale" NOT NULL,
    "shown" JSONB NOT NULL,
    "latencyMs" INTEGER,
    "retentionUntil" TIMESTAMP(3) NOT NULL,
    "prevHash" TEXT NOT NULL,
    "hash" TEXT NOT NULL,

    CONSTRAINT "insight_event_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customer_response" (
    "id" TEXT NOT NULL,
    "insightEventId" TEXT NOT NULL,
    "action" "ResponseAction" NOT NULL,
    "optionKey" TEXT,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "customer_response_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "alert" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "insightEventId" TEXT,
    "rulePackKey" TEXT NOT NULL,
    "severity" "Severity" NOT NULL,
    "dedupeKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "readAt" TIMESTAMP(3),
    "dismissedAt" TIMESTAMP(3),

    CONSTRAINT "alert_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "proactive_job" (
    "id" TEXT NOT NULL,
    "bankId" TEXT NOT NULL,
    "rulePackKey" TEXT NOT NULL,
    "schedule" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "lastRunAt" TIMESTAMP(3),

    CONSTRAINT "proactive_job_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inbound_event" (
    "id" TEXT NOT NULL,
    "bankId" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inbound_event_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "console_user" (
    "id" TEXT NOT NULL,
    "bankId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" "ConsoleRole" NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "console_user_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "approval_log" (
    "id" TEXT NOT NULL,
    "bankId" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "fromStatus" TEXT,
    "toStatus" TEXT,
    "actorId" TEXT NOT NULL,
    "comment" TEXT,
    "diff" JSONB,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "approval_log_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "customer_bankId_externalRef_key" ON "customer"("bankId", "externalRef");

-- CreateIndex
CREATE UNIQUE INDEX "customer_bankId_personaKey_key" ON "customer"("bankId", "personaKey");

-- CreateIndex
CREATE INDEX "consent_customerId_purpose_idx" ON "consent"("customerId", "purpose");

-- CreateIndex
CREATE INDEX "account_customerId_idx" ON "account"("customerId");

-- CreateIndex
CREATE INDEX "card_customerId_idx" ON "card"("customerId");

-- CreateIndex
CREATE UNIQUE INDEX "rewards_ledger_cardId_key" ON "rewards_ledger"("cardId");

-- CreateIndex
CREATE INDEX "instalment_plan_cardId_idx" ON "instalment_plan"("cardId");

-- CreateIndex
CREATE INDEX "finance_customerId_idx" ON "finance"("customerId");

-- CreateIndex
CREATE INDEX "deposit_customerId_idx" ON "deposit"("customerId");

-- CreateIndex
CREATE INDEX "transaction_accountId_postedAt_idx" ON "transaction"("accountId", "postedAt");

-- CreateIndex
CREATE INDEX "transaction_cardId_postedAt_idx" ON "transaction"("cardId", "postedAt");

-- CreateIndex
CREATE INDEX "transaction_feeCode_idx" ON "transaction"("feeCode");

-- CreateIndex
CREATE UNIQUE INDEX "fee_schedule_bankId_code_version_key" ON "fee_schedule"("bankId", "code", "version");

-- CreateIndex
CREATE UNIQUE INDEX "rule_pack_bankId_key_variant_version_key" ON "rule_pack"("bankId", "key", "variant", "version");

-- CreateIndex
CREATE INDEX "template_bankId_rulePackKey_variant_locale_idx" ON "template"("bankId", "rulePackKey", "variant", "locale");

-- CreateIndex
CREATE UNIQUE INDEX "template_bankId_key_locale_severity_version_key" ON "template"("bankId", "key", "locale", "severity", "version");

-- CreateIndex
CREATE UNIQUE INDEX "insight_event_seq_key" ON "insight_event"("seq");

-- CreateIndex
CREATE UNIQUE INDEX "insight_event_hash_key" ON "insight_event"("hash");

-- CreateIndex
CREATE INDEX "insight_event_bankId_customerRefHash_occurredAt_idx" ON "insight_event"("bankId", "customerRefHash", "occurredAt");

-- CreateIndex
CREATE INDEX "insight_event_bankId_rulePackKey_occurredAt_idx" ON "insight_event"("bankId", "rulePackKey", "occurredAt");

-- CreateIndex
CREATE INDEX "customer_response_insightEventId_idx" ON "customer_response"("insightEventId");

-- CreateIndex
CREATE UNIQUE INDEX "alert_customerId_dedupeKey_key" ON "alert"("customerId", "dedupeKey");

-- CreateIndex
CREATE UNIQUE INDEX "proactive_job_bankId_rulePackKey_key" ON "proactive_job"("bankId", "rulePackKey");

-- CreateIndex
CREATE UNIQUE INDEX "inbound_event_bankId_idempotencyKey_key" ON "inbound_event"("bankId", "idempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "console_user_bankId_email_key" ON "console_user"("bankId", "email");

-- CreateIndex
CREATE INDEX "approval_log_bankId_entityType_entityId_idx" ON "approval_log"("bankId", "entityType", "entityId");

-- AddForeignKey
ALTER TABLE "customer" ADD CONSTRAINT "customer_bankId_fkey" FOREIGN KEY ("bankId") REFERENCES "bank"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consent" ADD CONSTRAINT "consent_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "account" ADD CONSTRAINT "account_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "standing_order" ADD CONSTRAINT "standing_order_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "account"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "card" ADD CONSTRAINT "card_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "card" ADD CONSTRAINT "card_settlementAccountId_fkey" FOREIGN KEY ("settlementAccountId") REFERENCES "account"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rewards_ledger" ADD CONSTRAINT "rewards_ledger_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "card"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "instalment_plan" ADD CONSTRAINT "instalment_plan_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "card"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finance" ADD CONSTRAINT "finance_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deposit" ADD CONSTRAINT "deposit_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transaction" ADD CONSTRAINT "transaction_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "account"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transaction" ADD CONSTRAINT "transaction_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "card"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fee_schedule" ADD CONSTRAINT "fee_schedule_bankId_fkey" FOREIGN KEY ("bankId") REFERENCES "bank"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rule_pack" ADD CONSTRAINT "rule_pack_bankId_fkey" FOREIGN KEY ("bankId") REFERENCES "bank"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "template" ADD CONSTRAINT "template_bankId_fkey" FOREIGN KEY ("bankId") REFERENCES "bank"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "insight_event" ADD CONSTRAINT "insight_event_bankId_fkey" FOREIGN KEY ("bankId") REFERENCES "bank"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_response" ADD CONSTRAINT "customer_response_insightEventId_fkey" FOREIGN KEY ("insightEventId") REFERENCES "insight_event"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alert" ADD CONSTRAINT "alert_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alert" ADD CONSTRAINT "alert_insightEventId_fkey" FOREIGN KEY ("insightEventId") REFERENCES "insight_event"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proactive_job" ADD CONSTRAINT "proactive_job_bankId_fkey" FOREIGN KEY ("bankId") REFERENCES "bank"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inbound_event" ADD CONSTRAINT "inbound_event_bankId_fkey" FOREIGN KEY ("bankId") REFERENCES "bank"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "console_user" ADD CONSTRAINT "console_user_bankId_fkey" FOREIGN KEY ("bankId") REFERENCES "bank"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approval_log" ADD CONSTRAINT "approval_log_bankId_fkey" FOREIGN KEY ("bankId") REFERENCES "bank"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approval_log" ADD CONSTRAINT "approval_log_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "console_user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
