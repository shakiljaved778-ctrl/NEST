# Data model

The source of truth is `packages/db/prisma/schema.prisma`, with migrations in
`packages/db/prisma/migrations`. This document explains the model and the rules around it.

**All data in the seed is synthetic.** Doha Demo Bank is fictional.

## Conventions

| Concern           | Rule                                                                                                                                                                                                                                                           |
| ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Tenancy           | Multi-bank capable: root rows carry `bankId`, and child rows inherit it through their parent. Deployed single-tenant.                                                                                                                                          |
| Money             | `Decimal(18,2)` in QAR. Application code uses `decimal.js` through `@amil/rules-engine` (`D()`, `round()`, `toMoneyString()`). No JS floats.                                                                                                                   |
| Rates             | `Decimal(9,4)` holding an **annual percent**: `36.0000` means 36% p.a., `4.7500` means 4.75% p.a.                                                                                                                                                              |
| Points            | `Int`. Point value is `Decimal(10,4)` QAR per point (for example `0.0100`).                                                                                                                                                                                    |
| JSON rules        | Every money value and rate inside a `Json` column is a decimal **string** (`"1.50"`), never a JSON number (D-004). A seed test enforces this.                                                                                                                  |
| Dates             | `timestamptz`. Calendar maths is done in UTC days (`@amil/rules-engine` `daysBetween`, `addMonths`).                                                                                                                                                           |
| PII               | Only `Customer.displayName`, `displayNameAr`, `phone`, `email`, `Account.number`, `iban` and `Card.pan`. Never sent to the model gateway (non-negotiable 6). Application-level AES-256-GCM encryption arrives in Phase 8, with no column type changes (D-006). |
| Audit             | `insight_event` and `customer_response` are append-only, enforced by Postgres triggers (see below).                                                                                                                                                            |
| Deterministic IDs | Seed IDs are readable and stable (`cus_khalid`, `card_khalid_platinum`, `fin_fatima_murabaha`) so demo links survive reseeding.                                                                                                                                |

## Entity overview

```
Bank ─┬─ Customer ─┬─ Consent
      │            ├─ Account ─┬─ StandingOrder
      │            │           └─ Transaction
      │            ├─ Card ────┬─ RewardsLedger (1:1)
      │            │           ├─ InstalmentPlan
      │            │           └─ Transaction
      │            ├─ Finance
      │            ├─ Deposit
      │            └─ Alert ──────────────┐
      ├─ FeeSchedule                      │
      ├─ RulePack                         │
      ├─ Template                         │
      ├─ InsightEvent ── CustomerResponse │ (audit, append-only)
      │        └──────────────────────────┘
      ├─ ProactiveJob
      ├─ InboundEvent (idempotency for POST /v1/events)
      └─ ConsoleUser ── ApprovalLog
```

## Entities

### Bank

Tenant configuration: names (en/ar), `defaultLocale`, `supportedLocales`, `brandTokens` (the widget's
CSS custom properties), `deepLinkScheme` (`ddb://`, because options are deep links and AMIL never
executes anything), `digitStyle` (`latn` | `arab`), `severityThresholds` (per pack; QAR amounts as
strings), `modelMode` (`redacted` by default | `in_country` | `off`) and `auditRetentionYears`
(default 10).

### Customer and Consent

`Customer` holds the bank's `externalRef` (what the bank sends as `customerRef`), display names in
both languages, `preferredLocale`, `segment`, `salaryTransfer`, and a demo-only `personaKey` used by
the persona switcher. `Consent` records `purpose` (`pre_decision_insights`, `proactive_alerts`,
`assistant`), `version`, `method`, `grantedAt`, `withdrawnAt` and `privacyPolicyVersion`. No
customer data is read for insights without an active consent (non-negotiable 5, enforced in Phase 3).

### Account and StandingOrder

A current or savings account (`variant` conventional | islamic), with `balance`, `status`,
`isSalaryAccount`, `lastActivityAt`, `dormancyDays` (the inactivity threshold), `closureFee`,
`chequesOutstanding` and `maintenanceFee` + `maintenanceFeeWaived` (salary-linked waivers).
Standing orders are a separate table with `payee`, `amount`, `frequency` and `nextRunAt`.

### Card, RewardsLedger and InstalmentPlan

`Card`: `type` (conventional | islamic), `tier`, `creditLimit`, `balance`, `statementBalance`,
`minDue`, `paymentDueAt`, `profitOrInterestRateApr`, `cashAdvanceFeePct` + `cashAdvanceMinFee`,
`annualFee`, `annualFeeChargedAt`, `annualFeeWaived`, `feeRefundRule`
(`{"type":"pro_rata_months","withinMonths":"12"}` or `{"type":"none"}`), `status` and
`supplementaryCount`.

`RewardsLedger` (one per card): points `balance`, `pointValueQar`, `expiryBuckets`
(`[{"points":8000,"expiresAt":"2026-11-14"}]`, summing to the balance) and `pendingCashback`.

`InstalmentPlan` (EPP): `originalAmount`, `principalRemaining`, `monthsRemaining`, `monthlyAmount`,
`earlyClosureFeeRule` (`{"type":"pct_of_remaining","pct":"2.00","min":"50.00"}`).

### Finance

A personal loan or Islamic finance: `type` conventional | murabaha | ijara, `originalPrincipal`,
`principalOutstanding`, `ratePct`, `tenorMonths`, `monthsElapsed`, `instalment`,
`nextInstalmentAt` and the full `schedule`:

```json
[
  {
    "n": 12,
    "dueAt": "2026-10-19",
    "principal": "2500.00",
    "profitOrInterest": "475.00",
    "instalment": "2975.00",
    "balanceAfter": "90000.00",
    "paid": false
  }
]
```

- Conventional and ijara: reducing-balance annuity schedule.
- Murabaha: flat profit fixed at inception (`P × rate × years`), spread evenly. The last row absorbs
  rounding so principal sums exactly to `originalPrincipal`.
- `settlementFeeRule`: conventional `{"type":"pct_of_outstanding","pct":"1.00","cap":"10000.00","floor":"0.00"}`;
  Islamic `{"type":"none"}`.
- `rebateRule`: murabaha ibra policy `{"type":"ibra_tiers","basis":"deferred_profit_not_yet_due","tiers":[{"minMonthsElapsed":0,"pct":"50.00"},{"minMonthsElapsed":12,"pct":"75.00"}]}`;
  ijara `{"type":"future_rental_profit_waived","pct":"100.00"}`; conventional `null`.
- `insuranceOrTakaful`: `{"kind":"insurance"|"takaful","premiumPaid":"1800.00","coverMonths":"48","refundRule":{"type":"pro_rata_months_unexpired"}}`.
- `salaryLinked`: pricing depends on the salary being transferred (used by `salary.transfer_change`).

### Deposit

A fixed/term deposit or an Islamic term investment: `principal`, `ratePct` (a fixed rate, or an
expected profit rate), `startAt`, `maturityAt`, `breakPenaltyRule`
(`{"type":"pct_of_principal","pct":"0.50","min":"250.00"}` or `{"type":"none"}`) and
`profitOnBreakRule` (`{"type":"reduced_rate","ratePct":"0.2500"}`).

### Transaction and FeeSchedule

`Transaction`: a positive `amount` with a `direction` (debit | credit), a `type` (purchase, payment,
fee, salary, instalment, interest_charge, profit_charge and others), `merchant`, `category`,
`postedAt` and, for charge lines, a `feeCode`. Each transaction belongs to either an account or a
card.

`FeeSchedule` is unique per `(bankId, code, version)` and carries plain-language `name`,
`description` and `avoidTip` in en and ar, plus an `amountRule`. Every seeded fee line maps to a
code, which is what makes "explain my charge" possible (Phase 5). Seeded codes:
`CARD_ANNUAL_FEE`, `CARD_LATE_PAYMENT`, `ISL_LATE_CHARITY`, `CARD_CASH_ADVANCE`, `CARD_FX`,
`CARD_OVERLIMIT`, `CARD_INTEREST`, `CARD_PROFIT`, `CARD_EPP_PROCESSING`, `CARD_BALANCE_TRANSFER`,
`CARD_STATEMENT_COPY`, `ACC_MAINTENANCE`, `ACC_CHEQUE_BOOK`, `ACC_SMS_ALERTS`, `ATM_OTHER_BANK`,
`ACC_CLOSURE`.

### RulePack and Template (bank-managed)

`RulePack` is unique per `(bankId, key, variant, version)`. It carries a `status` (draft | active |
retired), an `enabled` kill switch, `parameters` (strings for money and rates) and `effectiveFrom`.

`Template` has `key`, `rulePackKey`, `variant`, `locale`, `severity`, `headline`, `body`, ordered
`options` (the loss-avoiding option first), `status` (draft | approved | sharia_approved | retired),
`version`, approval metadata and an `enabled` kill switch. Only approved templates are served
(`sharia_approved` for Islamic packs). Packs and templates are seeded alongside each pack's
implementation (Phase 2 and Phase 5).

### InsightEvent and CustomerResponse (audit)

One `InsightEvent` is written per evaluation. It records the trigger, `customerRefHash` (an HMAC of
the bank's ref, never the raw ref), pack key + version + variant, `inputSnapshotHash`, `facts`,
template key + version, model provider + version (if used), `validatorResult`, `severity`, `locale`,
exactly what was `shown`, `latencyMs` and `retentionUntil`. Tamper evidence comes from `seq`
(monotonic), `prevHash` and `hash`. `CustomerResponse` records `continued | chose_option |
talk_to_someone | dismissed` plus `optionKey`.

Audit rows reference customers by hash, **not by foreign key**, so they survive product-data resets
and customer deletion.

**Append-only enforcement** (migration `20260930194700_audit_append_only`):

- `UPDATE` and `DELETE` on either table raise `insufficient_privilege`.
- `TRUNCATE` on either table is rejected.
- The only exception is the retention purge (D-005). A `DELETE` is allowed inside a transaction that
  ran `SET LOCAL amil.audit_purge = 'on'`, and only for rows whose `retentionUntil` has passed (for a
  `customer_response`, that of its parent event).
- `packages/db/src/audit-triggers.int.test.ts` covers every one of these cases.

### Alert, ProactiveJob and InboundEvent

`Alert` is the proactive inbox (`dedupeKey` is unique per customer). `ProactiveJob` holds the cron
schedule per proactive pack (`account.dormancy`, `rewards.expiry`). `InboundEvent` stores bank
webhook events with a unique `(bankId, idempotencyKey)`.

### ConsoleUser and ApprovalLog

Console users have a role: `admin | product | compliance | sharia | viewer`. `ApprovalLog` records
every console action on templates and rule packs (status transitions, kill switches, parameter
diffs).

## Seed

`pnpm db:seed` loads the dataset produced by the pure builder `buildSeedData(now)`
(`packages/db/src/seed/build.ts`).

- 1 bank (Doha Demo Bank, `ddb://`), 5 console users (one per role), 2 proactive jobs, 16 fee codes.
- 25 customers (`packages/db/src/seed/customers.ts`), mixed en/ar and conventional/Islamic. The
  header of that file maps each rule pack to the personas that trigger it. Priya and Ali have no
  consent, to demonstrate non-negotiable 5.
- Named personas:
  - **Khalid**: Platinum card, 42,000 points at QAR 0.01, 8,000 expiring in 45 days, one active EPP
    (QAR 3,600 remaining over 6 months), 1 supplementary card, annual fee charged 2 months ago.
  - **Fatima**: murabaha of QAR 120,000 at 4.75% flat over 48 months. 11 instalments of QAR 2,975.00
    are paid and the next falls due in 19 days, which is when the ibra tier rises from 50% to 75%. She
    also has takaful of QAR 1,800.
  - **Ravi**: Gold card at 92% utilisation. He pays the minimum only (QAR 907.50) and has a cash
    withdrawal and a late fee on record.
  - **Aisha**: QAR 200,000 12-month term deposit at 4.25%, 9 days from maturity.
  - **Omar**: salary-linked personal loan, with the account maintenance fee and card annual fee
    waived because his salary is transferred.
- Around 2,700 transactions over 6 months. Every fee line carries a `feeCode`.
- Dates are relative to `SEED_NOW` or the current time (D-002). Reseeding keeps audit tables intact
  (D-003).
