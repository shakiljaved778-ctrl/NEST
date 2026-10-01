# Decisions

Where the master prompt was ambiguous, the option chosen is the one that best protects the
customer and the bank's auditability. Newest decisions are at the bottom.

## D-001: AMIL is a standalone repository (Phase 1)

AMIL is its own pnpm + Turborepo monorepo with the workspace at the repository root. It shares no
code, tooling or CI with any other product. Phase 1 was first drafted inside another repository and
then moved here, as requested, before any further work.

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

## D-008: Turborepo agent guidance disabled (Phase 1)

Turborepo 2.11 writes an `AGENTS.md` into the repo when it detects an AI agent. `turbo.json` sets
`"agentGuidance": false` so that tool-generated instructions do not end up in the repository. Our
instructions live in `CLAUDE.md`.

## D-009: Audit rows are keyed by a hashed customer ref, not a foreign key (Phase 1)

`InsightEvent.customerRefHash` is an HMAC of the bank's customer reference (implemented in Phase 3
with a per-deployment secret). There is no foreign key to `Customer`. The audit trail therefore
survives product-data resets and customer offboarding, and the audit table holds no directly
identifying value. A complaints lookup hashes the ref the same way to find a customer's events.

## D-010: Phase 1 open questions resolved with the defaults (Phase 2)

Confirmed by the product owner:

- **Fatima's cheaper date** comes from the tiered ibra policy on her murabaha: 50% of deferred
  profit not yet due before 12 instalments are paid, 75% from 12. Her 12th instalment falls due in
  19 days, so settling then saves QAR 4,000.00 net of the instalment and the takaful refund. All
  parameters are synthetic.
- **No named persona starts without consent.** Priya and Ali remain the only no-consent customers.

## D-011: Annual-fee refund counts started months as used (Phase 2)

`card.close` refunds the annual fee pro rata over the refund window (`feeRefundRule.withinMonths`,
12 in the demo). A partially used month counts as used, so the figure shown is never more than the
bank's policy would actually refund. A fee charged on the day of closure is refunded in full.

## D-012: Severity basis per flagship pack (Phase 2)

Severity is the avoidable cost of acting now, compared with the bank's thresholds:

- `card.close`: forfeited value (points + forfeited pending cashback) **plus** instalment
  early-closure fees. This is the loss the "Redeem points first" / "View instalments" paths help
  avoid. It is exposed as the `avoidableLoss` fact. Khalid: 420.00 + 72.00 = 492.00, which is at
  least 250, so critical.
- `finance.early_settlement`: the saving from settling on the cheapest date in the horizon rather
  than today. Salary-linked finance is at least `caution`, because benefits may change. Fatima's
  4,000.00 is at least 1,000, so critical.

## D-013: Template mini-language (Phase 2)

Approved copy uses `{fact}` placeholders and conditional sections: `[[fact: text]]` renders when
the fact is non-zero/true, and `[[!fact: text]]` when it is zero/false/absent. This keeps irrelevant
sentences, such as "0 points expire", out of the cards without generating any wording. An
unresolved placeholder is reported as `missing`, and such copy must not be served. The copy lint
judges the visible text with the markup stripped (`stripTemplateSyntax`).

## D-014: Murabaha settlement and instalment assumptions (Phase 2)

- A settlement quote for a future date assumes instalments due before then are paid on schedule,
  which is the only assumption the bank's own schedule supports. Those instalments count in the
  "total outflow" being compared.
- Overdue unpaid instalments (arrears) are owed in full on settlement. They do not count towards
  ibra tiers or takaful/insurance months.
- Murabaha profit does not accrue daily (the sale price is fixed), so the outflow is flat between due
  dates. Conventional and ijara accrue actual/365 (a pack parameter). For ijara, future rental profit
  is not charged and is shown as `futureProfitNotCharged`.
- The cheapest date is the **earliest** day with the minimum outflow.

## D-015: HMAC covers timestamp, method, path and body; each signature is single-use (Phase 3)

The prompt asks for a signature "over body + timestamp". AMIL signs
`${timestamp}.${METHOD}.${path-with-query}.${raw-body}` with HMAC-SHA256. Binding the method and
path stops a valid signature for one endpoint from being replayed against another. Timestamps must
be within ±5 minutes. Every accepted signature is also recorded (Redis `SET NX`, 10-minute TTL),
so an identical request is rejected even inside the window. Signatures are compared in constant
time, and the raw body is captured before JSON parsing.

## D-016: API credentials come from the environment for the MVP (Phase 3)

`AMIL_API_KEYS=keyId:secret:bankId[,…]` configures bank-to-AMIL credentials. This keeps the MVP
simple and keeps secrets out of the database until application-level encryption lands. Phase 8
moves them to an encrypted, rotatable credential store, with mTLS termination in front of the API
(the design is mTLS-ready: auth sits behind a single `authenticate()` seam).

## D-017: Anthropic provider settings, and why no refusal fallback model (Phase 3)

- The model is `claude-opus-5-5` by default, configurable with `AMIL_ANTHROPIC_MODEL`. Output is
  structured (`messages.parse` + Zod), effort is `low` (short, fact-bound wording), there are no SDK
  retries, and the request timeout comes from the gateway.
- The wording deadline is 1.5 s (`MODEL_TIMEOUT_MS`). Past it, the approved template is served
  immediately and generation finishes in the background to warm the 24-hour wording cache, as
  section 7 describes. Thinking is always on for this model, so on a cold cache the template will
  often be what the customer sees first. A bank can choose a faster model per deployment.
- **No server-side fallback model.** A refusal, timeout or invalid output all end in the same safe
  place: the bank-approved static template, which needs no model at all. A second model would add
  latency and another data flow without improving correctness.

## D-018: The AI disclosure is shown only when a model actually wrote the wording (Phase 3)

Every card shows "Figures from {bank} records as of {date}." The sentence "Wording assisted by AI."
is added only when the wording came from a model, either directly or from the wording cache. It is
omitted for the approved static template and for the offline mock provider, which echoes approved
copy. Claiming AI assistance that did not happen would mislead the customer. The audit event
records `aiAssisted` and `wordingSource` either way.

## D-019: Without consent, no product data is read (Phase 3)

When there is no active `pre_decision_insights` consent, `/v1/checks` does not load the card or
finance at all, not even to find its variant. It serves the bank's **generic** template for the
action: product information with no figures, and no customer data. Because the variant is unknown,
generic copy must be variant-neutral, and a lint test checks every generic template against the
Islamic terminology rules as well. The audit event records `consent: "absent"`.

## D-020: Suppressed insights are audited too (Phase 3)

When an insight is not shown, an audit event is still written with `applicable: false` and
`shown.suppressed` set to the reason: a disabled rule pack, invalid stored parameters, no approved
or enabled template, a template that fails to render, or nothing to show. A complaints lookup
(Phase 7) can then explain why a customer saw nothing as well as what they saw.

## D-021: Model output must pass the full copy policy, not only the number validator (Phase 3)

Besides non-negotiable 2 (no figures absent from the fact set), model wording is checked against
the same policy as the bank's templates: banned selling terms, Sharia terminology for Islamic packs,
no exclamation marks or emojis, headline ≤ 90 and body ≤ 280 characters. Any failure serves the
approved template and is audited as `validator_rejected`, with reasons.

## D-022: The redactor fails closed (Phase 3)

The outbound payload is built from facts only. Identity-like keys are dropped, and each value must
match its unit's strict shape: money and points have at most 9 integer digits, so a 12-digit account
number cannot pass as an amount. The serialized payload is then scanned for emails, IBANs, long
digit runs and phone numbers. Any finding aborts the model call and the template is used. Property
tests (fast-check) generate synthetic PII and assert that it never reaches the payload.

## D-023: Integration tests use a real PostgreSQL via TEST_DATABASE_URL (Phase 3)

The prompt suggests testcontainers. The build environment has no Docker daemon, so integration tests
run against a disposable database named by `TEST_DATABASE_URL` (the CI workflow provides a Postgres
service). Tests are skipped when it is unset. The assertions are the same as with testcontainers;
switching later only changes where the database comes from.

## D-024: The demo bank's server plays the bank backend; one shared demo database (Phase 4)

`apps/demo-bank` is built the way a real bank app would integrate:

- its Next.js server is the bank backend: it reads its own (synthetic) records, and holds the AMIL
  HMAC credential;
- the browser only receives a 15-minute AMIL session token for the logged-in customer;
- `<amil-insight>` calls the AMIL API directly with that token (CORS allow-list).

For the MVP, the demo bank and AMIL read the same PostgreSQL database of synthetic product
records. In a pilot, AMIL keeps its own store, fed by the bank via `POST /v1/events` (Phase 5) or
a replicated read-only view. The engine only sees products through the adapters, so swapping the
source does not touch the rules.

## D-025: The app locale lives in a cookie, not a URL prefix (Phase 4)

next-intl runs without i18n routing. The locale is read from the `ddb_locale` cookie, and
`<html lang dir>` is set from it. Bank deep links (`ddb://cards/{id}/rewards`) therefore stay
locale-free, and the same link works for English and Arabic sessions.

## D-026: shadcn/ui primitives are written into packages/ui directly (Phase 4)

shadcn/ui is copy-in source rather than a dependency. The few primitives the apps need (Button,
Card, Badge, `cn`) are authored in the shadcn style (cva + tailwind-merge + clsx), themed by
`--ui-*` CSS variables. The build environment has no access to the shadcn registry. More
components can be added the same way, or with the CLI where the registry is reachable.

## D-027: The widget owns the AMIL interaction; the host owns navigation (Phase 4)

`<amil-insight>` runs the check itself (session token), records the customer's response, and
emits `amil-option` with the bank's deep link. It never navigates; the host app maps `ddb://` to
its own routes. If AMIL has nothing to show (`kind: none`) or is unavailable, the widget emits
`amil-ready` (`kind: none`) or `amil-unavailable` and the host shows its own Continue button. The
customer is never blocked by AMIL (section 7). On critical cards, the continue-type option
(`continue_closure`, `settle_now`) stays disabled until "I understand" is ticked; the
loss-avoiding options are always available.

## D-028: Playwright is pinned to the pre-installed browser build (Phase 4)

`@playwright/test` is pinned to 1.56.1, which matches the Chromium build available in the build
environment. CI installs the matching browser with `playwright install --with-deps chromium`.
`PLAYWRIGHT_CHROMIUM_EXECUTABLE` can point the tests at any other Chromium.

## D-029: Phase 3 open questions kept at their defaults (Phase 4)

There is no answer yet on the wording model or mTLS. The defaults stay: `claude-opus-5-5`
(switchable with `AMIL_ANTHROPIC_MODEL`), and the mTLS decision deferred to Phase 8. Neither
affects Phase 4, which runs on the offline mock provider.
