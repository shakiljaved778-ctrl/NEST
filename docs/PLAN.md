# AMIL AI: Build Plan

AMIL (عميل, "customer") is a pre-decision intelligence layer that banks embed in their mobile
and online banking. Before a customer takes a consequential action (closing a card, settling
finance early, breaking a deposit, and similar), the bank app calls AMIL. AMIL computes exactly
what the customer gains or loses from their own products and the bank's rules, then returns an
insight card in English or Arabic. The card's options deep-link back into the bank's own flows.

This file restates the master prompt as a checklist. It is kept in sync with the code. Legend:
`[x]` done · `[~]` partially done or stubbed (see the phase report) · `[ ]` not started.

## Section 0: Working rules

- [x] `docs/PLAN.md` (this file) and `CLAUDE.md` created and kept updated
- [x] One phase at a time; at the end of each: lint, typecheck, tests, fix, commit `phase-N: <summary>`, write `docs/phase-N-report.md`, stop for go-ahead
- [x] Never invent regulatory facts or real bank product terms; all parameters are synthetic demo values, labelled in seed files and in the UI footer ("Demo data — Doha Demo Bank is fictional")
- [x] Boring, well-typed, testable code; every money calculation has unit tests with worked examples
- [x] Ambiguities resolved in favour of customer protection and auditability, and logged in `docs/DECISIONS.md`

## Section 2: Non-negotiables (enforced in code, tests and CLAUDE.md)

- [x] 1. Facts are computed by the deterministic rules engine; the LLM only rewords the approved copy from a redacted fact template
- [x] 2. Number validator rejects any LLM number, amount, percentage or date absent from the fact set (Arabic-Indic, extended and full-width digits, zero-width tricks, spelled-out numbers); falls back to the approved template; adversarial tests
- [x] 3. Inform, never execute: options are deep links on the bank's scheme (`ddb://…`)
- [x] 4. No selling: banned-term lint over all templates and over model output (configurable, en + ar); console copy checker on every draft and approval (Phase 7, D-058)
- [x] 5. Consent first: no product data read without an active consent; generic, data-free copy otherwise (D-019)
- [x] 6. Data stays in-country: gateway modes `redacted` (default), `in_country`, `off`; fail-closed redactor with property tests
- [x] 7. Everything audited: immutable, hash-chained `InsightEvent` per evaluation (including suppressed ones), customer responses, retention 10 years; `pnpm audit:verify`
- [x] 8. Bank approves all copy: only `approved` templates served, Islamic only `sharia_approved`
- [x] 9. Kill switches per rule pack and per template; disabled → `kind: none`, never an error; console switches (Phase 7, D-057)
- [x] 10. Money is decimal (`decimal.js`), QAR 2 dp, rounding mode is a rule-pack parameter (`roundingMode` in every pack)

## Section 3: Stack

- [x] Turborepo + pnpm monorepo, TypeScript strict, ESLint + Prettier, Vitest
- [x] Playwright (pinned 1.56.1, D-028)
- [x] `apps/demo-bank`: Next.js 15, Tailwind v4, shadcn-style UI, next-intl (en/ar, RTL)
- [x] `apps/console`: Next.js 15, Tailwind v4, Chart.js (Phase 7)
- [x] `apps/api`: Fastify, OpenAPI 3.1 generated from Zod, Swagger UI at `/docs`
- [x] `packages/rules-engine`: contract, facts, severity, money and date helpers
- [x] `packages/rule-packs`: versioned JSON + calculators + approved copy; all 12 packs × 2 variants (Phases 2, 5)
- [x] `packages/widget`: Lit `<amil-insight>` (Phase 4) · `<amil-assistant>` (Phase 6)
- [x] `packages/sdk`: Zod contract + typed server (HMAC) and widget (session) clients
- [x] `packages/gateway`: providers (anthropic, in_country, mock), redactor, number validator, wording cache
- [x] `packages/db`: Prisma schema, migrations, seed
- [x] `packages/i18n`: en/ar number, date and currency formatting, Arabic-Indic digits, glossary
- [x] `packages/ui`: shared shadcn-style components (D-026)
- [x] PostgreSQL 16, Redis 7 (docker-compose) · [x] BullMQ (Phase 5: proactive worker, schedules mirrored from ProactiveJob, D-039)
- [x] LangGraph.js assistant (Phase 6)
- [x] pino structured logs (Phase 1) · [x] OpenTelemetry tracing, OTLP when configured (Phase 8, D-070)
- [x] `docker-compose.yml`, `Dockerfile` per app (slim API image) · [x] `infra/terraform` skeleton, GCP in-country (Phase 8, D-071)
- [x] `.env.example`; `ANTHROPIC_API_KEY` optional (mock provider fallback, Phase 3)

## Section 4: Domain model (Prisma)

- [x] Bank, Customer, Consent, Account (+ StandingOrder), Card, RewardsLedger, InstalmentPlan, Finance, Deposit, Transaction, FeeSchedule, RulePack, Template, InsightEvent, CustomerResponse, ProactiveJob, ConsoleUser, ApprovalLog (+ Alert, InboundEvent)
- [x] Multi-bank capable (every tenant row carries `bankId`), deployed single-tenant
- [x] Money columns `Decimal(18,2)`; money inside JSON rules stored as strings, never JSON numbers
- [x] InsightEvent and CustomerResponse append-only (DB triggers), `prevHash` + `hash` chain columns
- [x] `docs/data-model.md`

## Section 5: Rules engine contract (Phase 2)

- [x] `RulePack` / `Evaluation` interfaces as specified; pure, `now` injected, no I/O (ESLint-enforced)
- [x] Facts carry `{ key, value, unit, source, asOf }`; `_sources` lists each distinct source
- [x] Severity computed from facts + bank thresholds (D-012)
- [x] 100% branch coverage on calculators (enforced by Vitest thresholds); table-driven tests with hand-worked examples

## Section 6: Rule packs (conventional + Islamic variants)

- [x] 1. card.close (flagship): both variants
- [x] 2. finance.early_settlement (flagship, cheapest date within 60 days): conventional, murabaha (ibra), ijara
- [x] 3. finance.top_up (Phase 5)
- [x] 4. card.cash_withdrawal (Phase 5)
- [x] 5. card.minimum_payment (Phase 5)
- [x] 6. card.epp_conversion (Phase 5)
- [x] 7. card.balance_transfer (Phase 5)
- [x] 8. deposit.break (Phase 5)
- [x] 9. salary.transfer_change (Phase 5)
- [x] 10. account.close (Phase 5)
- [x] 11. account.dormancy (proactive, Phase 5)
- [x] 12. rewards.expiry (proactive, Phase 5)
- [x] Islamic variants use Sharia terminology (lint-enforced) and are seeded `sharia_approved`

## Section 7: API (Phase 3+)

- [x] HMAC-signed server calls (`X-AMIL-Key`, `X-AMIL-Timestamp`, `X-AMIL-Signature`, 5-minute window, single-use signatures), mTLS-ready (D-015)
- [x] `POST /v1/sessions` (15-minute widget token)
- [x] `POST/GET/DELETE /v1/consents`
- [x] `POST /v1/checks` (p95 51 ms measured with mock; model deadline 1.5 s → template, async cache warm)
- [x] `POST /v1/insights/:id/responses`
- [x] `GET /v1/alerts` + `POST /v1/alerts/:id/read` (Phase 5, D-038)
- [x] `POST /v1/explain-charge` (Phase 5, D-040)
- [x] `POST /v1/compare` (Phase 6, D-049)
- [x] `POST /v1/assistant/messages` SSE (Phase 6, D-045..D-047)
- [x] `POST /v1/events` with idempotency key (Phase 5, recorded only in the MVP, D-043)
- [x] `/v1/admin/*` with RBAC: sign-in, dashboard, rule packs, templates + workflow, approvals, audit, complaints, compliance (Phase 7, D-054..D-062)
- [x] `GET /healthz`, `GET /readyz`, `GET /docs`
- [x] Errors never leak to the customer UI (generic error codes; no-insight is never an error)

## Section 8: Model gateway (Phase 3)

- [x] Provider interface; anthropic, in_country (OpenAI-compatible stub), mock
- [x] Redactor with property-based tests (fast-check)
- [x] Versioned prompt `packages/gateway/prompts/insight.v1.md`; Zod-validated JSON output (headline ≤ 90, body ≤ 280)
- [x] Number validator + static-template fallback + `validator_rejected` log
- [x] Arabic MSA glossary `packages/i18n/glossary.ar.json`, injected into the Arabic fact template; key-term tests
- [x] Redis wording cache (24 h)

## Section 9: Ask AMIL (Phase 6)

- [x] LangGraph graph: classify_intent → fetch_customer_context → compute → draft_answer → validate_numbers → guard → respond (`apps/api/src/assistant`, D-046)
- [x] Tools: getProducts, evaluatePack, explainCharge, compareScenario, searchProductRules (knowledge markdown in `packages/rule-packs/knowledge`, D-050)
- [x] Out-of-scope and investment-advice refusal + "Talk to someone"; fact chips with sources; conversation audit (one event per turn, D-051)
- [x] Free text never reaches the model: local en/ar intent classification (D-045); answers stream only after validation (D-047)
- [x] `<amil-assistant>` web component (streaming, fact chips, compare table, suggestions, RTL)

## Section 10: Demo bank app (Phase 4+)

- [x] Phone-framed app, persona switcher, home, card/finance/deposit/account detail, one AMIL-checked flow for every action, deep-link targets, settings (Phases 4–5) · [x] deposit break, salary change, account close, statements with tappable charges, alerts inbox (Phase 5) · [x] Ask AMIL tab, compare views (Phase 6)
- [x] Critical severity requires "I understand" before "Continue" enables

## Section 11: Bank console (Phase 7)

- [x] Dashboard (Chart.js): insights by pack and severity, per day, responses, reconsidered actions, estimated value protected, validator rejection rate, latency (D-060)
- [x] Rule packs: list, kill switch, parameter editor with validation, diff review, effective date, version history, change log (D-056, D-057)
- [x] Templates: editor, live preview at each severity beside the other language, copy checker as you type, approval workflow product → compliance → Sharia, kill switch, versions and history (D-058, D-059)
- [x] Audit: search by customer ref (keyed hash), pack and dates; event view with hash and link check; whole-chain verify; CSV and JSON export (D-061)
- [x] Complaints lookup: what a customer was shown and how they responded, chain verified (D-061)
- [x] Compliance pack: model card, data flow, fields each pack reads, live redaction proof, retention, consent purposes (D-062)

## Section 12: Seed data

- [x] Doha Demo Bank, brand tokens, `ddb://` deep-link scheme
- [x] 25 synthetic customers (en + ar display names), mixed conventional/Islamic
- [x] Named personas: Khalid, Fatima, Ravi, Aisha, Omar with the specified holdings
- [x] Holdings designed so every rule pack can fire for ≥ 2 personas (coverage map in `packages/db/src/seed/customers.ts`; verified in Phase 5 by `packages/db/src/personas.phase5.test.ts`)
- [x] 6 months of transactions per customer incl. fee lines mapped to `FeeSchedule` codes
- [x] Templates: 12 packs × 2 variants × 2 locales × 3 severities (144) + 48 generic, `approved` / `sharia_approved` (Phases 2, 5)

## Section 13: Security and quality

- [x] Zod validation on every request (strict schemas), CORS allow-list for widget origins · [x] rate limiting (D-064), helmet headers, nonce CSP for the apps and widget host (D-065)
- [x] AES-256-GCM application-level PII encryption with KMS interface and key rotation (Phase 8, D-066)
- [x] RBAC on console with segregation of duties (D-055); console changes in the approval log, sign-ins and customer-level reads in the activity log, both append-only (D-068) · [x] signed request nonce (D-063) · [x] HMAC keys with a purpose (D-067)
- [x] Integration tests against real PostgreSQL via TEST_DATABASE_URL (D-023) · [x] e2e (Playwright): demo bank (16) and console (7) suites
- [x] CI: GitHub Actions lint, typecheck, test, build, Playwright e2e (`.github/workflows/ci.yml`) · [x] dependency audit, Terraform validate, Docker demo smoke test (Phase 8, D-069, D-072)

## Section 14: Phases

- [x] **Phase 1: Foundation.** Monorepo, tooling, docker-compose, Prisma schema, migrations, seed. ✅ `pnpm dev` runs all apps; `pnpm db:seed` works; `docs/data-model.md`
- [x] **Phase 2: Rules engine + flagship packs.** ≥ 40 table-driven tests; Khalid and Fatima match expected facts exactly
- [x] **Phase 3: Insight API + gateway.** Redaction property tests, validator (Arabic-Indic), audit chain verifies, p95 < 400 ms with mock
- [x] **Phase 4: Demo bank app + widget.** Playwright: Khalid sees points insight in en + ar, deep-links to "Redeem points"
- [x] **Phase 5: Remaining packs + proactive + explain.** Every pack fires for ≥ 2 personas; alerts after scheduler; all fee lines explainable
- [x] **Phase 6: Ask AMIL + compare.** Khalid card-close answer with fact chips; refuses investment advice; compare matches engine
- [x] **Phase 7: Bank console.** Point-value change flows to next insight; kill switch immediate; complaints lookup shows Khalid
- [x] **Phase 8: Hardening + demo.** Headers, encryption, rate limits, CI, Terraform, DEMO_SCRIPT, INTEGRATION_GUIDE, SECURITY; fresh clone to running demo in ≤ 3 commands

## Section 15: Voice and copy rules (all templates)

- [x] Calm, factual, second person; no alarmism, emojis or exclamation marks (enforced by template lint test)
- [x] Lead with consequence and value; avoid-the-loss option first, then Continue, then Talk to someone (option order lint-enforced)
- [x] Arabic written natively against the glossary; glossary injected into Arabic model requests
- [x] Footer: "Figures from Doha Demo Bank records as of {asOf}. Wording assisted by AI." (+ Arabic); the AI line only when a model wrote the wording (D-018)
