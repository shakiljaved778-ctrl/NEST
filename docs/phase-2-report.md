# Phase 2 report: Rules engine + flagship packs

**Status:** complete. Waiting for go-ahead to start Phase 3 (insight API + model gateway).

## Acceptance criteria

| Criterion                                          | Result                                                                                                                                                                  |
| -------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ≥ 40 table-driven tests with hand-worked examples  | ✅ The rule-packs package alone has **242** tests (calculators, template engine, copy lint). The worked arithmetic is written in comments next to each case.            |
| Khalid's evaluation matches expected facts exactly | ✅ `packages/db/src/personas.test.ts` evaluates his **actual seed rows** through the adapters and the registered pack and compares all 22 facts with `toEqual`.         |
| Fatima's evaluation matches expected facts exactly | ✅ Same test file: all 21 facts, including the cheaper date in 19 days and the 4,000.00 saving.                                                                         |
| Lint, typecheck, tests, build                      | ✅ All clean. **402 tests** in total (rule-packs 242, db 73 incl. DB integration, rules-engine 53, i18n 28, api 6).                                                     |
| 100% branch coverage target on calculators         | ✅ 100% branches, lines, functions and statements on both calculators and the template engine. It is **enforced**: `pnpm test` in rule-packs fails below the threshold. |

## What was built

### `packages/rules-engine`: the contract (section 5)

- `RulePack<I, P, K>` and `Evaluation<K>` follow the specified contract: `applicable`, `severity`,
  `facts` with `_sources`, ordered `options` and machine-readable `explanation`. `AnyEvaluation` is
  for pack-agnostic code.
- Every `Fact` is `{ key, value, unit, source, asOf }`. Values are strings: decimal money, integer
  points, ISO dates, `"true"`/`"false"`. `FactBuilder` rejects duplicate keys and de-duplicates
  `_sources`.
- `severityForAmount` (inclusive thresholds) and `maxSeverity`.
- Packs are pure: `now` is injected, and ESLint bans `new Date()`, `Date.now()`, `parseFloat`,
  `toFixed` and `Math.round` in engine and pack code.

### `packages/rule-packs`

- **Versioned pack files**: `packs/card.close.{conventional,islamic}.json` and
  `packs/finance.early_settlement.{conventional,islamic}.json`. Each holds a semver version,
  triggers, required data, parameters (Zod-validated at load) and **declared facts** with unit,
  source and description. Tests assert that the calculators emit exactly the declared facts. These
  declarations will feed the console's compliance page ("data fields each pack reads").
- **`card.close`**, with these facts:
  - points balance and QAR value;
  - points expiring within the window (90 days, a parameter), with value and next expiry date;
  - pending cashback (forfeited or credited, a parameter);
  - active instalment plans, with remaining principal, early-closure fees (none, fixed, or % with
    min/max) and the total payable;
  - pro-rata annual-fee refund (D-011);
  - supplementary cards, outstanding balance, net amount to clear, and `avoidableLoss`.

  Options: `redeem_points` → `view_instalments` → `continue_closure` → `talk_to_someone`.

- **`finance.early_settlement`**:
  - quotes settlement for **every day** from today to +60 (a parameter), and picks the **earliest
    cheapest** net outflow (instalments paid until then + settlement − cover refund);
  - conventional: principal + accrued interest (actual/365 or /360) + % fee with cap and floor;
  - murabaha: remaining sale price − ibra at the tier reached by that date;
  - ijara: outstanding + accrued rental profit, with future profit not charged;
  - arrears included in full; insurance/takaful refund pro rata on unexpired months;
  - salary-linked flag.

  Options: `schedule_settlement` (only when cheaper later) → `partial_prepayment` (a parameter) →
  `settle_now` → `talk_to_someone`.

- **Approved copy**: 24 templates (2 packs × 2 variants × en/ar × info/caution/critical). The Arabic
  is written natively against the glossary. A small template language (`{fact}`, `[[fact: …]]`,
  `[[!fact: …]]`, D-013) keeps zero-value sentences out.
- **Copy lint** (`policy/copy-policy.json`, bank-configurable):
  - banned selling terms in en and ar (non-negotiable 4), whole-word in English and multi-word in
    Arabic, so "عرض خطط التقسيط" (view instalment plans) is not flagged;
  - no `!` and no emojis;
  - no conventional terms ("interest", "loan", "insurance", فائدة, قرض, التأمين) in Islamic copy;
  - option order: loss-avoiding first, then continue, then talk to someone;
  - matching option keys between en and ar;
  - headline ≤ 90 characters when rendered against real evaluations.

### `packages/db`

- `adapters.ts` turns product rows (Prisma models or seed inputs) into engine inputs. It
  Zod-validates every JSON rule and rejects floats, malformed buckets and empty schedules: it throws
  rather than defaulting. `thresholdsFor` reads the bank's per-pack thresholds and falls back to the
  bank default.
- The seed now also writes the 4 rule-pack rows (active, enabled, default parameters) and the 24
  templates (`approved`, or `sharia_approved` for Islamic copy). IDs are deterministic.
- Persona tests run every seeded card through `card.close` and every seeded finance through
  `finance.early_settlement`, then render the matching template in en and ar with no missing
  placeholders.

### What the customer would see (rendered in tests)

Khalid, English, critical:

> **Closing this card forfeits 42,000 points (about QAR 420.00)**
> Your 42,000 reward points, worth about QAR 420.00, end when the card closes. Of these, 8,000
> points were due to expire within 90 days. Your instalment plans become payable in full: QAR
> 3,672.00, including QAR 72.00 in early-closure fees. You are due a refund of QAR 1,250.00 from the
> annual fee. Supplementary cards on this card (1) close too. The balance to clear is QAR 6,250.00.
>
> [Redeem points first] [View instalment plans] [Continue closing the card] [Talk to someone]

Fatima, Arabic, critical headline:

> **السداد في 19 أكتوبر 2026 بدلاً من اليوم يقلّل ما تدفعه بمقدار 4,000.00 ر.ق**

(The footer "Figures from Doha Demo Bank records as of … Wording assisted by AI." is added by the
card renderer in Phase 3/4, not by each template.)

## How to run

```bash
pnpm db:seed                               # now also seeds rule packs + templates
pnpm --filter @amil/rule-packs test        # calculators + copy lint, with enforced coverage
pnpm --filter @amil/db test                # persona acceptance tests (+ DB integration if TEST_DATABASE_URL)
pnpm lint && pnpm typecheck && pnpm test && pnpm build
```

## Stubbed or deferred

- The packs aren't wired into the API yet. `/v1/checks`, consent gating, kill-switch lookup, the
  audit writer and the LLM gateway are Phase 3. Template **selection at serving time** (approved
  status, enabled flag) is enforced there too.
- Pack parameters come from the JSON defaults. Bank overrides stored in `RulePack.parameters` take
  effect once the API reads them (Phase 3) and the console edits them (Phase 7).
- Packs 3–12 are Phase 5.
- `salary.transfer_change` will compute the actual pricing uplift and the waivers lost. For now,
  `finance.early_settlement` only flags a salary-linked finance (at least caution).

## Where this work lives

`amil-ai` isn't reachable from the build session, so Phase 2 is committed on top of Phase 1 and
pushed to the temporary branch **`amil-ai-export`** on the NEST repository, which shares no history
with NEST. Import both phases into `amil-ai` with
`git fetch https://github.com/shakiljaved778-ctrl/NEST amil-ai-export && git push origin FETCH_HEAD:refs/heads/main`,
then delete the temporary branch.

## Open questions for you

1. **Cashback on closure.** The demo parameter says pending cashback is _forfeited_ when a card is
   closed. That's a synthetic choice that makes the insight show a loss. Keep it, or set it to
   `credited`?
2. **"Talk to someone".** Every card ends with this option. In Phase 4 should it deep-link to a
   bank callback screen (`ddb://support/callback`) or to a chat screen? Both are stubs in the demo
   app.
