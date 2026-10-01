# CLAUDE.md: AMIL AI

AMIL (عميل) is a B2B2C pre-decision intelligence layer that banks embed in their apps. Before a
customer takes a consequential action, AMIL computes what they gain or lose, from their own
products and the bank's rules, and returns an insight card (en/ar). See `docs/PLAN.md` for the
full checklist and `docs/DECISIONS.md` for recorded decisions.

## Non-negotiables (enforce in code, tests and review)

1. **Facts are computed, never generated.** Every number, date and amount shown to a customer comes from the deterministic rules engine. The LLM only writes wording around a fact set.
2. **Number validator.** Reject any LLM output that contains a number, amount, percentage or date absent from the fact set after normalisation (including Arabic-Indic digits ٠-٩). Fall back to the approved static template. Keep adversarial tests.
3. **Inform, never execute.** AMIL never moves money, changes a product or blocks an action. Options are deep links (per-bank `bank://` scheme) back into the bank app.
4. **No selling.** No offers, cross-sell or marketing in any insight. A lint-style test scans all templates for banned terms (configurable, en + ar).
5. **Consent first.** No customer data is read for insights until a consent record exists. Without consent, return only generic product information.
6. **Data stays in-country.** Gateway modes are `redacted` (default: the LLM sees only a de-identified fact template, with no name, customer ID, account or card numbers, IBAN, phone, email or free text) and `in_country`. Redaction has its own test suite.
7. **Everything is audited.** Every evaluation writes an immutable `InsightEvent` (hash-chained, append-only at DB level). Retention is configurable, 10 years by default.
8. **Bank approves all copy.** Only templates with status `approved` are served. Islamic packs require `sharia_approved`.
9. **Kill switches.** Per rule pack and per template. A disabled item returns no insight, never an error to the customer.
10. **Money is decimal.** Use `decimal.js` (via `@amil/rules-engine` money helpers) for all money arithmetic, with no JS floats for money. Currency is QAR with 2 dp. Rounding mode is a rule-pack parameter; the default is half-up, and banker's rounding applies only where a rule says so. In JSON (rule parameters, rules on products), write money and rates as **strings**, never JSON numbers.

Also:

- All product parameters are **synthetic demo values**. Never invent regulatory facts or real bank product terms. Doha Demo Bank is fictional, and every customer-facing UI shows "Demo data — Doha Demo Bank is fictional".
- Voice: calm, factual, second person. No alarmism, no emojis, no exclamation marks. Offer the loss-avoiding option first, then "Continue", then "Talk to someone".
- When in doubt, choose what best protects the customer and the bank's auditability, and log it in `docs/DECISIONS.md`.

## Stack

Turborepo + pnpm 10, TypeScript strict (ESM, `moduleResolution: Bundler`), ESLint 9 flat config +
Prettier, Vitest. Next.js 15 (demo-bank, console), Fastify 5 (api), Prisma 6 + PostgreSQL 16,
Redis 7, decimal.js. Internal packages are consumed as TypeScript source (`@amil/*`, `main:
src/index.ts`); Next apps list them in `transpilePackages`, and the api is bundled with tsup.

```
apps/api          Fastify API                          :4000
apps/demo-bank    Doha Demo Bank phone-framed app      :3000
apps/console      Bank staff console                   :3001
packages/db       Prisma schema, migrations, seed (+ pure seed-data builder)
packages/rules-engine  Pure TS engine + money helpers (zero I/O)
packages/rule-packs    Versioned pack JSON + calculators
packages/gateway  Model gateway, redactor, number validator
packages/i18n     en/ar formatting, digits, glossary
packages/widget   Lit web components
packages/sdk      Typed API client
packages/ui       Shared React components
```

## Commands (run from the repo root)

```bash
pnpm install
cp .env.example .env              # then adjust if needed
docker compose up -d postgres redis   # or local Postgres 16 / Redis 7
pnpm db:migrate                   # prisma migrate deploy
pnpm db:seed                      # idempotent; resets demo product data, keeps the audit trail
pnpm dev                          # api :4000, demo-bank :3000, console :3001
pnpm lint && pnpm typecheck && pnpm test
pnpm build
pnpm db:migrate:dev --name <x>    # create a new migration (dev)
pnpm db:reset                     # DEV ONLY: drop + re-migrate + seed (wipes the audit trail)
pnpm audit:verify [bankId]        # verify the audit hash chain
pnpm --filter @amil/gateway gen:prompts   # after editing packages/gateway/prompts/*.md
pnpm format                       # prettier --write
```

`TEST_DATABASE_URL` points DB integration tests (`packages/db/src/*.int.test.ts`) at a separate
disposable database. They are skipped when it is unset.

## Conventions

- Rules engine and rule packs are pure: inject `now: Date` and never call `new Date()` or `Date.now()` inside them; no I/O.
- Money: `Money`/`D` helpers from `@amil/rules-engine`. The ESLint config bans `parseFloat`, `Number.prototype.toFixed` and `Math.round` in engine and pack code.
- Table-driven tests with hand-worked examples in comments for every calculation.
- Prisma: money `Decimal(18,2)`, rates `Decimal(9,4)` as annual **percent** (for example `36.0000` = 36% p.a.), points `Int`, point value `Decimal(10,4)` QAR.
- PII lives only on `Customer` (displayName, displayNameAr, phone, email), `Account` (number, iban) and `Card` (pan). Never pass these to the gateway.
- Audit tables (`insight_event`, `customer_response`) are append-only (Postgres triggers). Never `UPDATE` or `DELETE` them in code.
- Seed IDs are deterministic (for example `cus_khalid`, `card_khalid_platinum`) so demo links stay stable across reseeds. Dates in the seed are relative to `SEED_NOW` (default: now).
- Rule packs (`packages/rule-packs`): each pack is `packs/<key>.<variant>.json` (versioned
  parameters, triggers, required data, declared facts) + a pure calculator + approved copy in
  `templates/<key>.json`. Tests assert that the declared facts match the emitted facts, that every
  pack × variant × locale × severity has exactly one template, and that templates render without
  missing placeholders. Copy policy (banned terms, Sharia terminology, no `!`/emojis, option order)
  lives in `policy/copy-policy.json`.
- Template syntax: `{fact}`, `[[fact: shown when non-zero]]`, `[[!fact: shown when zero]]` (D-013).
- Use `AnyEvaluation` / `AnyFactSet` for code that handles evaluations without knowing the pack.
- Figures become text only through `formatFact` (`@amil/gateway`), for templates, fact chips and the
  model's fact template alike, so the number validator sees exactly what the customer sees.
- The model never sees customer records: `buildFactTemplate` (redactor) is the only payload builder,
  and it fails closed. Model output goes through `checkModelOutput` (schema, numbers, copy policy).
- API: every route validates its input with the strict Zod schemas in `@amil/sdk/schemas`, and the
  OpenAPI document is generated from the same schemas. Errors carry generic codes only. "No insight"
  (consent, kill switch, template) is `200 { kind: "none" }`, never an error.
- Audit: append through `appendInsightEvent` only; never write `insight_event` directly.
- Product rules on DB rows reach the engine only through `@amil/db/adapters`, which Zod-validate
  them. Malformed rules throw and are never defaulted.
- Commits: `phase-N: <summary>` at phase ends; otherwise conventional short messages.
- At the end of each phase, write `docs/phase-N-report.md`, update `docs/PLAN.md`, then stop for review.
