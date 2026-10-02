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

_Superseded by D-066 (Phase 8): the PII columns are now encrypted._

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

## D-030: One pack registry; every calculator has the same signature (Phase 5)

`PACKS` in `packages/rule-packs/src/registry.ts` maps each of the 12 pack keys to its two
variants, each loaded from its versioned JSON with its Zod parameter schema (`parametersSchema`,
used by the API to validate bank overrides before computing with them). Calculators that need
neither thresholds nor `now` are adapted to the uniform `(input, params, thresholds, now)`, so the
API and the scheduler handle every pack the same way (`getPack(key, variant)`). The flagship
`cardClosePacks` / `financeEarlySettlementPacks` exports remain.

## D-031: Product rows → pack input lives in one shared resolver (Phase 5)

`resolvePackInput(packKey, bundle, context, dataAsOf)` in `@amil/db` turns a customer's rows into
any pack's input. The API loads the bundle with Prisma (`loadCustomerBundle`); the persona tests
build it from the seed (`bundleFromSeed`). What is tested is what is served. A check missing a
required context value (`PACK_REQUIRED_CONTEXT`) is a 400 `missing_context`; an unknown, inactive
or other customer's product is a 404. Amounts in the context are decimal strings; a JSON number is
rejected (non-negotiable 10).

## D-032: Phase 5 worked examples are verified independently (Phase 5)

Every worked example in a calculator comment and test was recomputed outside TypeScript (Python
`Decimal`, half-up). Three first drafts were wrong and were corrected before the tests were
written: minimum payment (12 months / 102.16, not 11 / 111.47), EPP revolving comparison (328.58,
not 300.00) and the top-up same-tenor total (3,082.26, not 3,067.32).

## D-033: Revolving balances: the payment is taken first, then the month's charge (Phase 5)

`amortiseRevolving` (minimum payment, EPP comparison, balance transfer) takes the month's payment
from the balance, then charges APR/12 on what remains, rounding each month's charge. The minimum-due
formula (bank parameters, matching the seed: max(5%, QAR 100), never above the balance) is
re-applied to the falling balance each month. A horizon (`maxMonths`) stops plans that never clear;
the card then says so (`minimumClearsBalance: false`).

## D-034: Top-up refinances at today's settlement amount (Phase 5)

`finance.top_up` refinances the existing finance at today's early-settlement amount, quoted by the
`finance.early_settlement` calculator (fee, ibra or future rental profit included), adds the
top-up, and prices the new amount over the new tenor: annuity for conventional and ijara, flat
(fixed at inception) for murabaha. The cost of the extension is compared with pricing the same new
amount over the months that remain today. "Keep a shorter term" is offered only when the tenor
actually extends.

## D-035: Salary transfer change: repricing and waivers (Phase 5)

Moving the salary reprices salary-linked conventional and ijara finance by the bank's uplift
(`rateUpliftPct`, demo 1.50 points) over the remaining term. Murabaha is not repriced: its sale
price was fixed at inception. Fee waivers tied to the salary (account maintenance, card annual
fees) end. The rates shown are those of the first finance that is actually repriced. The variant
follows the salary account.

## D-036: Account closure severity comes from what breaks, not only from money (Phase 5)

Outstanding cheques and salary-linked finance on the salary account are critical; standing orders,
cards paid from the account and the salary account itself are caution; the closure fee sets a floor
through the bank's thresholds. "Review standing orders" is offered only when there are some.

## D-037: Proactive packs: dormancy by time, rewards by value (Phase 5)

`account.dormancy` is time-based (critical within 30 days, caution within 60; bank parameters):
no money is lost, but a dormant account is restricted. `rewards.expiry` reports cumulative 30 / 60
/ 90-day windows and the next expiry date, with severity from the value expiring within the widest
window. Proactive packs have no "continue" option: there is no action in progress. The option-order
lint now requires `talk_to_someone` last and, for action packs only, exactly one continue option
just before it.

## D-038: How a scheduled run becomes alerts (Phase 5)

`runProactive(deps, bankId, pack)` reads only customers with a live `proactive_alerts` consent
(non-negotiable 5) and evaluates each product through the same pipeline as a check: kill switch,
stored parameters, approved template, gateway, audit (`trigger: schedule:<pack>`). Then:

- A non-applicable product is not audited: nothing was shown to anyone.
- The alert's dedupe key is product + event date (`rewards.expiry:card_x:2026-11-14`), so re-running
  the job, the same day or the next, never alerts a customer twice about the same expiry or
  dormancy date. A duplicate is not audited again.
- The alert is worded and audited in every language the bank supports, preferred language first.
  `Alert.localeEventIds` (new migration) maps locale → audit event, and `GET /v1/alerts?locale=`
  serves the card in the language the customer is reading. Found by the Phase 5 e2e test: a
  customer switching the app to Arabic saw English alerts.
- Withdrawing proactive-alert consent hides existing alerts immediately.

## D-039: BullMQ schedules mirror the ProactiveJob rows (Phase 5)

The worker (`apps/api/src/worker.ts`, `pnpm worker`) upserts one BullMQ job scheduler per enabled
`ProactiveJob` row (cron in `Asia/Qatar`) and removes schedulers whose row is disabled or gone. It
re-syncs every 5 minutes, so console changes (Phase 7) take effect without a restart. Jobs run one
at a time with 3 attempts and exponential backoff. `pnpm proactive:run [pack] [--queue]` runs a pack
now (demo, operations), in-process or through the queue. docker-compose gains a `worker` service.

## D-040: Explain my charge is computed from the fee schedule, never generated (Phase 5)

`POST /v1/explain-charge` takes the fee schedule version in force when the fee posted, and words
the explanation with the bank's own approved name, description and how-to-avoid text (en/ar). No
model is involved. The calculation is recomputed from the customer's transactions:

- fixed fees: compared with the published amount;
- percentage fees: matched to the same-day transaction the fee applies to, restricted by type
  (cash withdrawal fee → the cash withdrawal; FX fee → a purchase). The screenshot review found
  that without the type restriction a minimum fee "matched" an unrelated small purchase;
- annual fees: compared with the card's fee;
- interest/profit charges: shows the rate, with `matches: null` (the month's balances are needed).

Without consent only general information is returned and no transaction is read. Every
explanation is audited (`rulePackKey: explain.charge`, version `fee_schedule@N`).

## D-041: Fact keys must pass the redactor's identity filter (Phase 5)

The gateway drops any fact whose key reads like an identity attribute (`account…`, `card…`). Three
new keys did (`accountBalance`, `cardFeesWaivedAnnual`, `isSalaryAccount`), so they were renamed
(`currentBalance`, `annualFeesWaived`, `receivesSalary`). The existing gateway test that checks
every declared fact key caught this.

## D-042: The number validator ignores Arabic short vowels when looking for spelled numbers (Phase 5)

The validator split words on anything that is not a letter, and Arabic diacritics are combining
marks, so "ستُعاد" (will be returned) was split into "ست" (six) + "عاد", and the approved
account-closure copy was rejected. Combining marks are now removed before tokenising. "ستّة" (six,
with shadda) is still rejected; both cases are tested.

## D-043: Inbound events are recorded, not processed, in the MVP (Phase 5)

`POST /v1/events` (bank backend only) records product events idempotently: the first delivery
returns 201, a retry with the same `idempotencyKey` returns 200 with `duplicate: true`, and a
concurrent retry is resolved by the unique `(bankId, idempotencyKey)`. While AMIL reads the bank's
synthetic records directly (D-024), events trigger no processing. In a pilot they feed AMIL's own
store.

## D-044: Copy choices for the new packs (Phase 5)

- "promo" and "promotion" are banned selling terms, so balance-transfer copy says "introductory
  rate" (Arabic "المعدل التمهيدي").
- Fact labels and "why" sentences are shared by both variants, so they are variant-neutral
  ("charges", "annual rate"); a test runs them through the Islamic copy lint.
- Literal digits never appear in copy: every number comes from a fact, so the validator accepts the
  approved wording.
- Per-pack severity thresholds were added to the demo bank (synthetic, D-002).

## D-045: Ask AMIL never sends the customer's free text to a model (Phase 6)

Non-negotiable 6 says the model sees only a de-identified fact template, never free text, and a
question can contain anything (names, account numbers). So `classify_intent` is a deterministic,
local en/ar classifier (`apps/api/src/assistant/classify.ts`): patterns for each pack, the three
comparisons, explain-a-charge, products, help, and refusals (investment advice, out of scope), with
the bank's FAQ as the fallback. It also extracts amounts (including Arabic-Indic digits), months and
product hints ("platinum", "murabaha"). A question about the customer's own products ("my card")
is answered from them; a definitional one ("What is ibra?") from the FAQ. The model's only role is
the one it already has: wording a computed fact set, through the same gateway, redactor and number
validator as a pre-action check. Suggestions carry a topic and a product id, never free text.

## D-046: The assistant graph and its tools (Phase 6)

LangGraph.js (`@langchain/langgraph`) runs `classify_intent → fetch_customer_context → compute →
draft_answer → validate_numbers → guard → respond`. Refusals, help and FAQ skip
`fetch_customer_context`: no customer data is read for them. Tools are injected, so the graph is
unit-tested with fakes and has no I/O of its own:

- `getProducts`, `evaluatePack` (the check pipeline up to, not including, its audit:
  `prepareInsight`), `compareScenario`, `latestCharge`, `explainCharge`, `searchProductRules`;
- `phrase`, which renders an approved Ask AMIL phrase.

When a question fits several products the assistant asks which (suggestions carry the product id).
When an action needs an amount it offers example amounts. Pack kill switches and approvals apply
exactly as for checks: a disabled pack or template yields the approved "unavailable" phrase, never
an error.

## D-047: The answer streams only after it has been validated (Phase 6)

`POST /v1/assistant/messages` is server-sent events: one `status` event per graph step while the
answer is computed, then `delta` events with the answer text, one `answer` event with the
structured answer, and `done`. Streaming model tokens as they arrive would show the customer
figures before the number validator and the guard had run (non-negotiable 2), so the text streams
only once it has passed both. Errors after the stream opens become a generic `error` event; errors
before it (auth, validation, unknown customer) are ordinary JSON errors.

## D-048: Validator and guard run on every answer, and on the approved copy itself (Phase 6)

`validate_numbers` re-checks the headline and body of every answer against its facts (defence in
depth: computed answers were already validated by the gateway). `guard` applies the copy policy
(selling terms, Sharia terminology) plus advice patterns ("I recommend", "you should buy", "أنصحك").
Detail paragraphs are the bank's own approved text (FAQ, fee schedule) and never pass through a
model. A failure replaces the answer with an approved phrase ("unavailable", or the advice
refusal).

A new gateway test runs every approved phrase, compare summary and FAQ entry through the real
validator. It caught approved copy that would always have been rejected:

- "pick **one** below" contains a spelled-out number;
- the Arabic "لست" ("I'm not") reads as ل + ست ("six").

Both were reworded.

## D-049: Compare views are engine functions with template-only copy (Phase 6)

`compareSettlementTiming`, `compareMinVsCustomPayment` and `compareDepositBreakVsWait`
(`packages/rule-packs/src/compare`) are pure and built on the same calculators as the packs, so a
comparison cannot disagree with the insight card for the same product. Tests and the API
integration test assert it field by field.

- **Settlement timing** shows today, the earliest cheapest date in the horizon, and the day after
  the next instalment, when that is a different date in the horizon.
- **Payment** shows the minimum, a fixed higher amount (the customer's, or the pack's default
  multiple), and the full balance.
- **Deposit** shows breaking today against keeping it to maturity.

The best option is marked (the first, on ties). `POST /v1/compare` applies consent
(`pre_decision_insights`), the underlying pack's kill switch and stored parameters, and approved
summary copy rendered from the facts with no model. Each comparison is audited as
`compare.<scenario>`.

## D-050: The bank's FAQ is markdown, compiled into the bundle (Phase 6)

`searchProductRules` searches bank-approved FAQ entries in
`packages/rule-packs/knowledge/{en,ar}/*.md` (front matter: id, title, keywords).
`pnpm --filter @amil/rule-packs gen:knowledge` compiles them into `knowledge.generated.ts`, and a
test fails if that file is stale.

- FAQ copy contains no figures: numbers only ever come from the engine. It is linted with the
  Islamic copy rules because it serves both variants.
- Matching folds Arabic letter variants, diacritics and the definite article.
- A question in either language finds the entry, and the answer is given in the customer's
  language.

## D-051: Ask AMIL's copy is bank-approved templates; each turn is one audit event (Phase 6)

Ask AMIL's phrases (help, refusals, consent, clarification, products, charge, nothing to flag,
unavailable) and the compare summaries are templates like the pack copy:

- kinds `assistant` and `compare`, seeded `approved` / `sharia_approved` (260 templates in total);
- served only when approved and enabled.

The assistant needs the `assistant` consent purpose, which is separate from pre-decision insights.
Each turn writes one `InsightEvent` (`rulePackKey: assistant`, `trigger: assistant`) with:

- the question, the intent and the checks run;
- exactly what was shown;
- the model provider and version, if the wording used one.

The question is stored because a complaints review needs it, and it stays in-country in the bank's
audit store (D-024). Comparisons and charge explanations used by a turn keep their own audit
events.

## D-052: API integration test files run one at a time (Phase 6)

The API's integration tests share one database, and some toggle kill switches (for example,
disabling `card.close`). Running files in parallel made a Phase 6 test see a disabled pack. Vitest
runs the API's test files sequentially (`fileParallelism: false`); tests within a file were already
sequential.

## D-053: The point value is a bank programme parameter, not only ledger data (Phase 7)

Section 11's acceptance test changes "Khalid's point value in the console". The ledger's
`pointValueQar` is customer data the console must not edit, so `card.close` and `rewards.expiry`
gain an optional parameter `programmePointValueQar` (up to 4 decimals, `null` by default). When
set, it values every card's points and the fact's source reads `rule_pack`; when empty, each
card's rewards ledger value is used as before. Both packs moved to version 1.1.0.

## D-054: Console sign-in, tokens and the browser boundary (Phase 7)

- **Sign-in.** The console's backend lists staff (`GET /v1/admin/users`) and mints an 8-hour
  console token (`POST /v1/admin/sessions`) over the bank's HMAC key. A bank would put its own
  SSO in front of this; the demo shows a staff picker.
- **Tokens.** Console tokens (JWT HS256, audience `amil-console`) are signed with a key derived
  from the session secret, so a widget token can never be used as a console token. Every request
  re-reads the user, so deactivating a user or changing a role takes effect at once.
- **Browser boundary.** The token lives only in an httpOnly, `SameSite=Strict` cookie (`Secure`
  in production). Pages read the console API server-side; interactive parts call a same-origin
  proxy (`/api/admin/*`) that attaches the token, refuses the sign-in routes, and rejects writes
  whose `Origin` is not the console.

## D-055: Console roles and segregation of duties (Phase 7)

| Role       | Can                                                                             |
| ---------- | ------------------------------------------------------------------------------- |
| product    | edit pack parameters, draft and submit copy, use kill switches                  |
| compliance | approve copy, search and export the audit log, complaints lookup, kill switches |
| sharia     | give the final approval for Islamic copy (and send it back)                     |
| admin      | edit pack parameters, use kill switches, read the audit log                     |
| viewer     | read dashboards, packs, copy and the compliance pack                            |

No role both drafts and approves copy. Kill switches stop harm, so three roles can use them.
The console hides what a role cannot use; the API enforces it (403).

## D-056: Pack parameter changes are new versions (Phase 7)

A change writes a new `RulePack` row: the merged parameters are validated against the pack's own
Zod schema first (staff see the field-level issues), the version's patch number is bumped
(1.1.0 → 1.1.1), and an effective date (now or later) is set. The approval log records the
changed keys before and after. The engine uses the latest active version already effective, so a
scheduled version takes over by itself and the history is never edited.

## D-057: A pack's kill switch covers all its versions (Phase 7)

Disabling `card.close` (conventional) disables every version of it, including scheduled ones, so a
version taking effect later cannot switch the pack back on. Customers get `kind: none`, never an
error, and the bank's own flow continues.

## D-058: Copy approval workflow (Phase 7)

`draft → in_review` (product submits) `→ approved` (compliance), or for Islamic copy
`→ compliance_approved → sharia_approved` (Sharia reviewer). Compliance or the Sharia reviewer
can send copy back to draft. Template statuses gain `in_review` and `compliance_approved`.

- **Checks** run on save and again on approval: copy policy (selling and banned terms, Sharia
  terminology in Islamic copy, no "!" or emojis), only facts the pack declares, no literal digits
  (figures come from facts), no customer data in generic copy, option keys and order unchanged.
- **Headline length** is measured on its longest reading (text outside sections plus the longest
  section), because headlines hold alternatives; the preview checks the rendered length.
- **Final approval retires** the other approved versions, so exactly one version per key, language
  and severity can be served. Each step is in the approval log.

## D-059: Template preview uses synthetic demo customers (Phase 7)

The editor renders the draft against a real evaluation of a demo persona for whom the pack fires,
one per severity where possible, beside the live copy in the other language. Demo data only: a
production console would preview against a bank-provided test profile, never a real customer.

## D-060: How the dashboard measures outcomes (Phase 7)

All figures come from the audit log for the chosen period.

- **Reconsidered:** an action insight the customer answered without "continued" (another option,
  talk to someone, or dismissed).
- **Value surfaced / protected:** each pack names its value-at-stake fact (`VALUE_AT_STAKE_FACT`,
  e.g. `avoidableLoss` for card closure; a test checks each is a declared QAR fact). Surfaced sums
  it over shown insights; protected over reconsidered ones. It is an estimate, labelled as such:
  AMIL never knows what the customer did next.
- **Validator rejection rate:** rejected model wordings over all wordings that went through the
  validator. **Latency:** p50 / p95 of shown action checks.

`pnpm --filter @amil/api demo:traffic` adds 30 days of synthetic checks and responses through the
real pipeline (same audit chain) so the dashboard has something to show.

## D-061: Audit search, export and the complaints lookup (Phase 7)

- **Search** by customer reference matches its keyed hash (the log never stores the reference),
  plus pack and date range, newest first, paged by sequence number.
- **Event view** recomputes the event's hash and checks its link to the previous event.
- **Export** (CSV or JSON, the same filters, up to 10,000 events) is compliance-only. CSV cells are
  quoted, and cells starting with `= + - @` are prefixed with `'` (spreadsheet formula injection).
- **Complaints lookup** lists only insights actually shown (not suppressed or not-applicable
  evaluations), with what each said, its facts and sources, the options, and the customer's
  responses, and verifies the bank's whole chain.

## D-062: The compliance pack is generated from the running system (Phase 7)

Model card (mode, providers, prompt version, deadline, cache, safeguards), data flow, the fields
each pack reads and the facts it computes, a real outbound model payload from the live redactor
(Khalid's card closure) with the list of fields never sent, retention and consent purposes. It
cannot drift from what the system does.

## D-063: An optional signed nonce on bank-to-AMIL requests (Phase 7)

Two identical signed requests in the same second have the same signature, so the replay guard
rejected the second one (found when the console's sign-in page was reloaded quickly). Requests
may now carry `X-AMIL-Nonce` (16–64 letters, digits or hyphens); it is appended to the signing
string (`….${body}.${nonce}`), so it cannot be added, changed or stripped without breaking the
signature. The SDK sends a fresh UUID on every call. Requests without a nonce verify as before.

## D-064: Rate limits per caller, shared in Redis (Phase 8)

`@fastify/rate-limit` keys each request by who is calling, before authentication:

- the bank key id for signed calls;
- a hash of the bearer token, separately for customer sessions and console users;
- otherwise the client IP.

A forged token only buys its own bucket of requests that all fail with 401.

Per-minute defaults:

| Caller                | Default |
| --------------------- | ------- |
| Bank key              | 6,000   |
| Customer session      | 120     |
| Console user          | 600     |
| Anonymous IP          | 300     |
| Ask AMIL, per session | 20      |

All of them are environment settings. The response is a generic `429 rate_limited` with
`Retry-After`, which the widget treats as unavailable. Counters live in Redis so several API
instances share them. If Redis is down, requests pass rather than fail, so a throttle can never
take the service down. Health checks are exempt.

## D-065: Security headers and a nonce-based CSP (Phase 8)

- **API.**
  - `@fastify/helmet`: HSTS, `nosniff`, frame options, referrer policy, COOP, and CORP
    `same-site` so the widget's CORS calls still work.
  - A deny-all CSP (`default-src 'none'; frame-ancestors 'none'`). Swagger UI at `/docs` keeps
    its own policy, without `upgrade-insecure-requests`, so it works over local http.
  - `Cache-Control: no-store` on everything under `/v1`.
- **Demo bank and console.**
  - Middleware sets a per-request nonce CSP: `script-src 'self' 'nonce-…' 'strict-dynamic'`,
    `connect-src` limited to the app and (for the demo bank) the AMIL API, `object-src 'none'`,
    `base-uri 'self'`, `form-action 'self'` and `frame-ancestors 'none'`.
  - `style-src` allows inline styles: brand tokens and charts use style attributes, and no
    script can run through them.
  - Static headers: `X-Frame-Options: DENY`, a referrer policy, a permissions policy, COOP, and
    HSTS in production.
  - The policy lives in `@amil/ui/security` (edge-safe) and is shared by both apps.
- **Tests.** Every Playwright test fails if the browser reports a CSP violation.

## D-066: PII encrypted at the application level (Phase 8)

The seven PII columns (`Customer.displayName/displayNameAr/phone/email`, `Account.number/iban`,
`Card.pan`) hold `enc:v1:<keyId>:<iv>:<ciphertext>:<tag>`.

- **Cipher.** AES-256-GCM with a random 96-bit IV. The authenticated data is
  `<table>.<column>:<rowId>`, so a value moved to another row or column fails to decrypt.
- **Keys** come from a `PiiKeyProvider`. For the demo that is `PII_ENCRYPTION_KEYS` (newest
  first). In production it is `kmsKeyProvider`: data keys wrapped by the bank's KMS and
  unwrapped once at start.
- **Rotation.** New writes use the newest key. Older keys still decrypt. `pnpm db:rotate-pii`
  re-encrypts every value under the newest key, after which the old key can be removed.
- **Who encrypts and decrypts.** The bank side does both: the seed (the only writer) and the demo
  bank's backend. AMIL's API and worker never read these columns, so they do not hold the key.
  This is the property a pilot keeps when AMIL has its own store.
- **No lookups.** Nothing looks a record up by these columns, so no blind index is needed.

## D-067: Each HMAC key has a purpose (Phase 8)

`AMIL_API_KEYS` entries are `keyId:secret:bankId[:purpose]`, where the purpose is `bank` (the
default) or `console`.

- A console key can only list staff and mint console tokens.
- A bank app key can call everything else but cannot sign staff into the console.
- A wrong-purpose call gets `403`.

The console app now has its own key (`AMIL_CONSOLE_KEY_ID/SECRET`), so a leaked app key cannot
mint staff sessions.

## D-068: Console reads are recorded; console logs are append-only (Phase 8)

A new `console_activity` table records:

- sign-ins;
- every look at customer-level data: audit search, event view, export, chain verification and
  complaints lookup.

Filters are kept, but a customer reference only as its keyed hash. Changes stay in
`approval_log`. Database triggers make both tables append-only, like the audit tables. Admin and
compliance see one combined list under **Console activity** (`GET /v1/admin/activity`).

## D-069: Dependency audit in CI, with pnpm overrides for transitive fixes (Phase 8)

`pnpm audit --prod --audit-level=high` runs in CI. The audit found:

- `postcss` < 8.5.23, pinned by Next (build-time CSS processing);
- `deepmerge-ts` < 8, from the Prisma CLI's config loader.

Both are lifted with overrides in `pnpm-workspace.yaml` and checked to work (Prisma generate and
migrate, both app builds). Each override should be removed once its parent package ships the
fix.

## D-070: OpenTelemetry tracing, off unless configured (Phase 8)

When `OTEL_EXPORTER_OTLP_ENDPOINT` is set, the API and worker start the OpenTelemetry Node SDK
with an OTLP/HTTP exporter. Otherwise every span is a no-op.

- **Spans:**
  - one per request, named by method and route pattern;
  - `amil.insight.prepare`, with pack, variant, locale, severity or suppression reason, and
    validator result;
  - `amil.gateway.word`;
  - `amil.audit.append`.
- **No customer data in attributes.** No customer references, figures or text, because traces
  leave the audit boundary.
- **Failures** are recorded without their messages.
- **Logs** stay pino; the audit log stays separate from both.
- **Instrumentation** is manual, not automatic, because auto-instrumentation needs ESM loader
  hooks in the bundled build.

## D-071: Terraform skeleton for one bank per GCP project, in-country (Phase 8)

`infra/terraform` targets GCP `me-central1` (Doha). It is a starting point a bank's platform team
reviews, not a turnkey stack.

- **Network:** a private VPC.
- **Database:** Cloud SQL PostgreSQL 16 with private IP, TLS only, CMEK and PITR backups kept in
  the region.
- **Cache:** Memorystore Redis with AUTH and TLS.
- **Keys:** Cloud KMS keys (the PII envelope key and the database CMEK), rotated yearly.
- **Secrets:** Secret Manager with in-region replication. Values are added out of band, never
  in state.
- **Services:** Cloud Run `api` and `console` (internal ingress, behind the bank's load balancer
  and identity-aware proxy), `worker` (always-on CPU), and a `migrate` job.
- **Identity:** one service account per service, reading only the secrets it needs.

The cloud is the bank's choice. Any provider with an in-country region works the same way. CI
runs `terraform fmt -check` and `terraform validate`.

## D-072: The demo from a fresh clone in three commands (Phase 8)

The three commands are `git clone …`, `cd amil-ai`, `docker compose up --build`. The one-shot
`setup` service then:

- migrates;
- seeds, with PII encrypted;
- on a fresh database only (`demo:traffic --if-empty`), adds 30 days of synthetic traffic;
- runs the proactive packs, so alerts exist.

After that the API, worker, demo bank and console start.

- **API image.** It is now slim: production dependencies only, through `pnpm deploy`, plus the
  generated Prisma client. That is 423 MB instead of the full ~1 GB workspace.
- **Demo bank image.** It installs OpenSSL for Prisma's engine.
- **CI.** A CI job runs exactly this compose stack and smoke-tests it. Container builds could not
  run in the development sandbox (package mirrors are blocked there), so CI is where the images
  are proven.
