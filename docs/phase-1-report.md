# Phase 1 report: Foundation

**Status:** complete. Waiting for go-ahead to start Phase 2 (rules engine + flagship packs).

## Acceptance criteria

| Criterion                                 | Result                                                                                                                                                                                    |
| ----------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm dev` runs all apps                  | ✅ api :4000 (`/healthz` 200, `/readyz` 200 with Postgres + Redis), demo-bank :3000 (200), console :3001 (200). Verified live.                                                            |
| `pnpm db:seed` works                      | ✅ 25 customers, 69 consents, 33 accounts, 5 standing orders, 19 cards, 9 rewards ledgers, 1 EPP, 6 finance, 3 deposits, ~2,730 transactions, 16 fee codes, 5 console users. Re-runnable. |
| Schema documented in `docs/data-model.md` | ✅                                                                                                                                                                                        |
| Lint, typecheck, tests                    | ✅ `pnpm lint`, `pnpm typecheck` and `pnpm format:check` are clean. `pnpm test`: **107 tests** (rules-engine 41, i18n 28, db 32 incl. 5 DB integration, api 6).                           |
| Build                                     | ✅ `pnpm build` (api via tsup, both Next apps as standalone output). The built API and the standalone demo-bank server were both started and answered.                                    |

## What was built

- **Monorepo** at the repo root (standalone repository, D-001): pnpm 10 workspaces + Turborepo 2, strict TypeScript
  (`noUncheckedIndexedAccess`), ESLint 9 flat config with type-aware rules, Prettier and Vitest.
  - The ESLint config bans `parseFloat`, `toFixed`, `Math.round`, `new Date()` and `Date.now()` in
    rules-engine and rule-pack code (non-negotiables 1 and 10).
- **`packages/rules-engine`**:
  - Money helpers on an isolated `decimal.js` clone. `D()` rejects non-integer JS numbers and
    non-decimal strings.
  - Explicit `half_up` / `half_even` rounding, plus `percentOf`, `proRata`, `clamp`, `sum`.
  - UTC calendar helpers (`daysBetween`, `addMonths` with month-end clamping).
  - Table-driven tests with worked examples.
- **`packages/i18n`**:
  - Deterministic en/ar formatting for money, numbers, percentages and dates, with optional
    Arabic-Indic digits.
  - `normaliseDigits`, for the future number validator, maps ٠-٩, ۰-۹, ٫, ٬ and ٪ to ASCII.
  - Bank-approved Arabic glossary (`glossary.ar.json`), with en/ar message catalogs checked for key
    parity.
- **`packages/db`**:
  - Prisma 6 schema with all section-4 entities, plus `StandingOrder`, `Alert` and `InboundEvent`.
  - Migrations include DB-level append-only triggers on `insight_event` and `customer_response`
    (UPDATE, DELETE and TRUNCATE are rejected; there is a guarded retention-purge path, D-005).
  - The pure seed builder `buildSeedData(now)` feeds the idempotent `pnpm db:seed`, which never
    touches audit tables.
- **Seed**: the fictional Doha Demo Bank (`ddb://`, brand tokens), 25 synthetic customers and all 5
  named personas with hand-checked values:
  - Khalid: 42,000 points = QAR 420.00, 8,000 expiring on day 45, EPP with 3,600.00 remaining.
  - Fatima: murabaha instalment 2,975.00, principal outstanding 92,500.00, next instalment on day 19.
  - Ravi: minimum due 907.50 at 92% utilisation.
  - Aisha: deposit maturing on day 9.
  - Omar: salary-linked loan and waivers.
  - 6 months of transactions, where every fee line maps to a `FeeSchedule` code with en/ar
    explanation and avoidance tip. Islamic cards use the late-payment charity code instead of a late
    fee.
  - All identifiers are provably synthetic: `0000` PANs that fail the Luhn check, `QA00` IBANs,
    non-dialable `+974 0000` phones and `.example.test` emails.
- **`apps/api`**:
  - Fastify 5 with Zod-validated config (fails fast on bad config).
  - `GET /healthz` (liveness) and `GET /readyz` (Postgres + Redis with a 2 s timeout per check).
  - A generic error handler that never leaks internals, and pino with auth-header redaction.
- **`apps/demo-bank`**: Next.js 15 + Tailwind v4 phone-framed shell with Doha Demo Bank brand tokens
  and the bilingual "Demo data — Doha Demo Bank is fictional" footer.
- **`apps/console`**: Next.js 15 console shell listing the Phase 7 areas.
- **Infra**:
  - `docker-compose.yml` (postgres 16, redis 7, one-shot `migrate` + seed, api, demo-bank, console)
    and a `Dockerfile` per app.
  - `.env.example`.
  - GitHub Actions `.github/workflows/ci.yml` (format, lint, typecheck, migrate + seed, test,
    build, with Postgres and Redis service containers).

## How to run

```bash
cp .env.example .env
docker compose up -d postgres redis    # or local Postgres 16 / Redis 7
pnpm install
pnpm db:migrate && pnpm db:seed
pnpm dev
```

To run DB integration tests locally, create a disposable database and set `TEST_DATABASE_URL` in
`.env` (see `.env.example`). They are skipped when it is unset.

## Stubbed or deferred (by design)

- `packages/rule-packs`, `gateway`, `sdk`, `widget` and `ui` are placeholders that export only
  constants such as pack keys and model modes. They are implemented in Phases 2–6.
- The demo-bank and console UIs are shells. next-intl, RTL switching, shadcn/ui and the persona
  switcher arrive in Phase 4, and the console features in Phase 7.
- Rule packs and templates are not seeded yet. Each pack's parameters and approved en/ar templates
  are seeded with its implementation (Phase 2 for the flagships, Phase 5 for the rest).
- Dockerfiles are functional but not slim. The API image carries the built workspace. Hardening is
  Phase 8.
- Transaction history is realistic in shape but is **not reconciled** to account and card balances.
  The engine reads balances from the product tables, not by summing transactions.

## Verification gaps in this environment

- **Docker was not available** in the build container (no daemon). `docker-compose.yml` and the
  Dockerfiles were therefore not exercised end to end. The same build commands the Dockerfiles run
  (`pnpm install --frozen-lockfile`, `turbo run build --filter=…`) and the standalone and dist entry
  points were run and verified outside Docker.
- The GitHub Actions workflow has not run yet. It runs on the first push.
- Local verification used Postgres 16.13 and Redis 7.0.15.

## Open questions for you

1. **Fatima's cheaper-date mechanic.** The synthetic ibra policy raises the rebate from 50% to 75%
   of deferred profit once 12 instalments are paid, and Fatima's 12th instalment is due in 19 days.
   Phase 2 will compute the cheapest date from these parameters. Is a tiered ibra policy an
   acceptable demo mechanic, or would you prefer a different driver, such as a fee waiver window?
2. **Consent in the demo.** Two customers (Priya and Ali) have no consent, to show the generic-only
   path. Should any named persona also start without consent, to demo the consent flow live?
