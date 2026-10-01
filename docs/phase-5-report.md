# Phase 5 report: Remaining packs, proactive alerts, explain my charge

**Status:** complete. Waiting for go-ahead to start Phase 6 (Ask AMIL + compare).

## Acceptance criteria

| Criterion                             | Result                                                                                                                                                                                                                                                                                                                                                                                                   |
| ------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Every pack fires for ≥ 2 personas     | ✅ `packages/db/src/personas.phase5.test.ts` evaluates **every consenting seeded customer** through the shared input resolver and the registered packs, and renders the approved copy en/ar for each hit. The API integration test then runs every action pack end to end over HTTP for the same personas, and checks that the approved wording passed the number validator. See the coverage map below. |
| Alerts appear after running scheduler | ✅ `runProactive` in-process **and** through BullMQ with real Redis (integration tests). Playwright runs `pnpm proactive:run` and then finds Khalid's rewards alert (English) and Grace's dormancy alert (Arabic) in the inbox, and follows **Redeem points**.                                                                                                                                           |
| Each fee line is explainable          | ✅ The integration test explains **every fee line on every consenting customer's statements**. Every one returns a named, described charge with how-to-avoid text, and none contradicts the published rule (`matches` is never `false`). Playwright: Ravi taps his cash-withdrawal fee and sees it matched to the ATM withdrawal.                                                                        |
| Lint, typecheck, tests, build         | ✅ All clean. **1,525 unit and integration tests**:<br>rule-packs 1,175 · db 110 · gateway 82 · api 65 · rules-engine 54 · i18n 28 · widget 10 · ui 1.<br>**11 Playwright tests** (5 from Phase 4, 6 new). The new calculators are held at 100% coverage, enforced.                                                                                                                                      |

### Persona coverage (consenting customers, default demo contexts)

| Pack                     | Fires for                                                                           |
| ------------------------ | ----------------------------------------------------------------------------------- |
| card.close               | 17 customers (Khalid, Hamad critical; Noura, Mohammed, Nasser caution; …)           |
| finance.early_settlement | Fatima (critical), Omar, Yousef, Sanjay (caution), Layla, Faisal                    |
| finance.top_up           | Fatima, Omar, Yousef, Layla, Sanjay, Faisal (QAR 20,000 over 60 months)             |
| card.cash_withdrawal     | every card holder (QAR 1,000: fee 60.00, 84.66 if repaid in 30 days)                |
| card.minimum_payment     | 17 card holders (Ravi critical: 111 months, QAR 15,321.28 in interest)              |
| card.epp_conversion      | Khalid, Noura, Hamad, Sara, Mohammed, Faisal, Nasser (largest purchase ≥ 1,000)     |
| card.balance_transfer    | every card holder (QAR 5,000)                                                       |
| deposit.break            | Aisha (critical), Mariam (Islamic, caution), Abdullah                               |
| salary.transfer_change   | Omar, Yousef, Sanjay                                                                |
| account.close            | every account; critical for Hessa (cheques) and salary accounts with linked finance |
| account.dormancy         | Tariq (45 days, caution), Grace (25 days, critical)                                 |
| rewards.expiry           | Khalid, Noura, Hamad, Mohammed                                                      |

Priya and Ali (no consent) never appear. They get generic, figure-free copy, and no alerts.

## What was built

### `packages/rule-packs`: packs 3–12

Ten new calculators, each with both variants (`packs/<key>.<variant>.json`: semver, triggers,
required data, parameters, declared facts). Each has approved copy in `templates/<key>.json`:

- en/ar × conventional/Islamic × info/caution/critical;
- generic no-consent copy;
- fact labels;
- "why" sentences.

That makes 192 templates in total.

| Pack                     | Computes                                                                                                         |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------- |
| `finance.top_up`         | refinance at today's settlement amount + top-up; new instalment and total; cost of extending vs the current term |
| `card.cash_withdrawal`   | fee (pct with minimum), cost if repaid in 30 / 60 days (charges from day one), available limit                   |
| `card.minimum_payment`   | months and total charges paying only the minimum; saving from a higher monthly amount                            |
| `card.epp_conversion`    | instalment, fee, plan charge, extra vs paying in full, charge if left to revolve, early-closure fee              |
| `card.balance_transfer`  | fee, introductory period and rate, owed when it ends, charges in the following year                              |
| `deposit.break`          | return at maturity vs broken today (reduced rate, penalty), return given up, difference                          |
| `salary.transfer_change` | repricing of salary-linked finance (murabaha unchanged), monthly increase, extra over term, waivers that end     |
| `account.close`          | cheques outstanding, standing orders (next date/amount), linked cards, salary account, closure fee, payout       |
| `account.dormancy`       | last activity, dormancy date, days left (proactive)                                                              |
| `rewards.expiry`         | points and value expiring within 30 / 60 / 90 days, next expiry (proactive)                                      |

A few notes:

- **Registry.** All 12 packs sit in one `PACKS` registry with a uniform signature (D-030). Shared
  finance maths lives in `shared/finance-math.ts`: annuity, flat and revolving (D-033).
- **Worked examples.** Every one was recomputed independently before its test was written. Three
  first drafts were wrong and were fixed (D-032). Aisha, as computed and shown:
  _"Keeping this deposit 9 more days pays QAR 9,012.33 more"_.
- **Copy lint.**
  - The option-order rule now also covers proactive packs, which have no continue option (D-037).
  - Labels and "why" sentences are checked against the Islamic terminology rules.
  - Copy never contains a literal digit (D-044).

### `packages/db`

- **One input path.** `resolvePackInput` / `loadCustomerBundle` / `bundleFromSeed` are the single
  path from product rows to pack input, for the API and the tests alike (D-031).
- **Supporting helpers.**
  - `PACK_REQUIRED_CONTEXT` lists the context each pack needs.
  - `proactiveContexts` and `alertDedupeKey` serve scheduled runs.
  - `demoContexts` sets the demo amounts.
- **Migration** `alert_locale_events`: `Alert.localeEventIds` (D-038).
- **Seed.** All 24 pack definitions and 192 templates, plus per-pack severity thresholds.

### `apps/api`

- **`POST /v1/checks`** handles all 10 action packs, with a richer context: `depositId`,
  `accountId`, `transactionId`, `amount`, `paymentAmount`, `months`. A missing context value is a
  400; another customer's product is a 404.
- **Shared pipeline.** `deliverInsight` and `makeAudit` serve checks, scheduled alerts and charge
  explanations: the same gates, the same audit.
- **Proactive alerts.**
  - `runProactive` reads only consenting customers.
  - One alert per product and event date.
  - Each alert is worded and audited in en and ar.
  - Duplicates are neither re-alerted nor re-audited (D-038).
- **BullMQ.**
  - `src/worker.ts` mirrors the `ProactiveJob` rows into cron schedulers (Asia/Qatar) and
    re-syncs every 5 minutes.
  - `pnpm proactive:run` runs a pack now, in-process or with `--queue` (D-039).
  - docker-compose gains a `worker` service.
- **New endpoints.**
  - `GET /v1/alerts` and `POST /v1/alerts/:id/read` (new scope `alerts:read`). Withdrawing
    proactive-alert consent hides alerts immediately.
  - `POST /v1/explain-charge` (new scope `charges:explain`), computed from the fee schedule and the
    customer's transactions, with no model (D-040).
  - `POST /v1/events` (bank backend only): idempotent, recorded only in the MVP (D-043).
- **Deep links** for all 25 options. OpenAPI covers every new path.

### `packages/sdk`, `packages/widget`, `packages/gateway`

- **SDK.** `CheckContext`, `Alert`/`AlertList`, `ChargeExplanation`, `EventRequest`/`EventAck`,
  plus `listAlerts`, `markAlertRead`, `explainCharge` and `pushEvent` on the clients.
- **`<amil-insight>`**
  - Takes a full `context` (JSON attribute or property).
  - Gates every `continue_*` option on critical cards.
  - Renders stored alert cards through `result`.
- **Validator fix.** It no longer reads "ستُعاد" (will be returned) as "ست" (six). Combining marks
  are dropped before the spelled-number scan (D-042).

### `apps/demo-bank`

- **One AMIL-checked flow for every action** (`/act/<action>?…`): the AMIL card first, then the
  bank's own confirmation. When AMIL has nothing to show, the bank's Continue appears.
- **New screens.**
  - Deposit detail (**Break deposit**).
  - Account detail: standing orders, cheques, statement and **Close account**.
  - Card actions: **Pay card**, **Statement**, **Withdraw cash**, **Balance transfer**,
    **Convert a purchase to instalments**.
  - Finance **Top up**, and Settings **Move my salary**.
- **Statements.** Fee lines can be tapped and open **About this charge**: the bank backend calls
  `explain-charge` over HMAC.
- **Alerts inbox.** Alert cards render with `<amil-insight>` in the language being read; the ones
  shown are marked read.
- **Other deep-link targets** (payments, confirmations, transfers) land on a generic "bank's own
  screen" placeholder. AMIL's job ends at the deep link.

## Found and fixed during the phase

- **Wrong worked examples** in three first drafts (D-032).
- **Fact keys dropped by the redactor.** Three fact keys read like identity attributes, so the
  redactor dropped them (D-041).
- **Approved Arabic copy rejected** by the validator (D-042), found by the integration test that
  requires `validatorResult: passed` for every persona.
- **Alerts only in the preferred language** (D-038), found by Playwright.
- **Wrong base transaction for a percentage fee.** The minimum fee let a cash-withdrawal fee match a
  small fuel purchase. Found from the screenshot review; fixed by restricting each fee to its
  transaction type, and asserted in tests (D-040).

## Screenshots

`docs/screenshots/`:

- `phase5-aisha-deposit-break-en.png`
- `phase5-omar-salary-en.png`
- `phase5-hessa-account-close-en.png`
- `phase5-ravi-minimum-payment-en.png`
- `phase5-ravi-explain-charge-en.png`
- `phase5-khalid-alerts-en.png`
- `phase5-grace-alerts-ar.png`

## How to run

```bash
pnpm db:migrate && pnpm db:seed
pnpm dev                          # API :4000, demo bank :3000
pnpm proactive:run                # write today's alerts now (what the 06:00 schedule does)
pnpm worker                       # or: run the BullMQ worker on its schedules
# open http://localhost:3000 → Aisha → deposit → Break deposit; Ravi → card → Statement → a fee;
# Khalid or Grace → Alerts. Toggle العربية in the header.
pnpm --filter @amil/demo-bank build && pnpm --filter @amil/demo-bank e2e
```

## Stubbed or deferred

- **Bank destinations.** Payment, transfer and confirmation screens are placeholders.
- **Interest/profit charges.** Explained with the rate, but not recomputed (`matches: null`): that
  needs the month's balances.
- **Inbound events** are recorded but not processed while AMIL reads the demo database (D-024).
- **Alerts.** There are no push notifications: alerts are read in the inbox, and are marked read
  when shown.
- **Scheduling.** `ProactiveJob` schedules are edited in the console in Phase 7. The worker already
  picks up changes.
- **EPP.** The demo plans are fee-only (0% plan rate); the plan-rate path is implemented and tested.
- **Docker images.** There is still no Docker daemon here to run the compose stack end to end.

## Where this work lives

Pushed to the temporary branch **`amil-ai-export`** on NEST (Phases 1–5; no shared history with
NEST). Import it into `amil-ai` with
`git fetch https://github.com/shakiljaved778-ctrl/NEST amil-ai-export && git push origin FETCH_HEAD:refs/heads/main`.

## Open questions for you

1. **Fact chips.** The new critical cards are dense: Hessa's account closure shows 8 chips, Omar's
   salary change 7. Keep all, or cap at four with a "more figures" expander?
2. **Demo amounts.** The demo buttons use QAR 1,000 cash, QAR 5,000 balance transfer and a
   QAR 20,000 / 60-month top-up. A real bank app would ask the customer first. Should the demo add
   an amount step, or keep the fixed examples?
3. **Still open from earlier phases:**
   - the wording model (Opus or a faster one);
   - mTLS at the bank's ingress;
   - whether pending cashback is forfeited or credited on card closure;
   - where "Talk to someone" goes.

   The defaults are in place.
