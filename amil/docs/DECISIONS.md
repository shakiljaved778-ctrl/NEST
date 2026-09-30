# Decisions

Where the master prompt was ambiguous, the option chosen is the one that best protects the
customer and the bank's auditability. Newest decisions are at the bottom.

## D-001: AMIL lives in `amil/` inside the existing repository (Phase 1)

The prompt assumes an empty folder, but this repository already holds an unrelated product (the
NEST home-services app at the repo root). To avoid destroying or entangling that work, AMIL is a
self-contained Turborepo in `amil/`, with its own `package.json`, lockfile and `CLAUDE.md`. Its CI
workflow sits at `.github/workflows/amil-ci.yml`, because GitHub only reads workflows from the repo
root, and is path-filtered to `amil/**`. AMIL can later move into its own repository with
`git subtree split --prefix amil`.

## D-002: Seed dates are relative to `SEED_NOW` (Phase 1)

The personas depend on relative timing: 8,000 points expire in 45 days, a deposit matures in 9 days,
and a settlement is cheaper in 19 days. The seed-data builder is therefore a pure function of
`now`. `pnpm db:seed` uses the `SEED_NOW` env var (ISO date) or the current time, so the demo works
on any day. Tests use a fixed `now` and assert exact values.

## D-003: Re-seeding keeps the audit trail (Phase 1)

`pnpm db:seed` is idempotent. It upserts the bank and replaces demo product data (customers,
products, transactions, fee schedule, console users). It never touches `insight_event` or
`customer_response`, which are append-only at the database level (a trigger rejects `UPDATE`,
`DELETE` and `TRUNCATE`). A full wipe requires `pnpm db:reset`, which drops and recreates the
schema and is a dev-only command. Audit rows reference customers by a hashed ref, not a foreign
key, so they survive product-data resets.

## D-004: Money and rates inside JSON are strings (Phase 1)

Rules stored as JSON (fee refund, early closure, settlement fee, ibra rebate, break penalty and so
on) write every money amount and rate as a decimal **string** (`"1.50"`), never a JSON number,
because JSON numbers are parsed as IEEE floats. Rates in columns and JSON are annual percentages
(`"5.5000"` = 5.5% p.a.).

## D-005: Retention purge is the only permitted delete on audit tables (Phase 1)

The append-only trigger allows a `DELETE` on `insight_event` only when the transaction has set
`amil.audit_purge = 'on'` **and** the row's `retentionUntil` is in the past. A dedicated
retention job will use this, and the purge itself will be audited (Phase 8). Hash-chain
verification then starts from the oldest retained event and uses its `prevHash` as the anchor.

## D-006: PII is stored in plaintext columns until Phase 8 (Phase 1)

The PII columns (`Customer.displayName/displayNameAr/phone/email`, `Account.number/iban`,
`Card.pan`) are `String` columns sized to later hold AES-256-GCM ciphertext. Application-level
encryption is Phase 8 scope, so the column types will not change. All card PANs, IBANs and phone
numbers in the seed are synthetic. PANs use the `0000` test prefix and are deliberately not
Luhn-valid.

## D-007: Tailwind CSS v4 and ESLint 9 (Phase 1)

These are the current stable majors. Both work with Next.js 15 and shadcn/ui (the shadcn CLI
supports Tailwind v4). ESLint 10 is newer, but `@next/eslint-plugin-next` 15 targets ESLint 9.

## D-008: Minimal isolation changes to the root NEST project (Phase 1)

The root `tsconfig.json` included `**/*.ts`, and the root `vitest run` had no config, so NEST's
typecheck, tests and Next build would have picked up AMIL's files. There are two isolation changes
at the root, and nothing else in NEST was touched:

- `amil` is added to `exclude` in the root `tsconfig.json`.
- A root `vitest.config.ts` excludes `amil/**`.

NEST's own CI commands (`npm run typecheck && npm test && npm run build`) were re-run and pass.

## D-009: Turborepo agent guidance disabled (Phase 1)

Turborepo 2.11 writes an `AGENTS.md` into the repo when it detects an AI agent. `turbo.json` sets
`"agentGuidance": false` so that tool-generated instructions do not end up in the repository. Our
instructions live in `CLAUDE.md`.

## D-010: Audit rows are keyed by a hashed customer ref, not a foreign key (Phase 1)

`InsightEvent.customerRefHash` is an HMAC of the bank's customer reference (implemented in Phase 3
with a per-deployment secret). There is no foreign key to `Customer`. The audit trail therefore
survives product-data resets and customer offboarding, and the audit table holds no directly
identifying value. A complaints lookup hashes the ref the same way to find a customer's events.
