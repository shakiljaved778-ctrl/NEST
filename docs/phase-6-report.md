# Phase 6 report: Ask AMIL + compare

**Status:** complete. Waiting for go-ahead to start Phase 7 (bank console).

## Acceptance criteria

| Criterion                                                                      | Result                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| ------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Ask AMIL answers "What happens if I close my card?" for Khalid with fact chips | ✅ API integration test over SSE: all seven graph steps stream as status events, then the answer: _"Closing this card forfeits 42,000 points (about QAR 420.00)"_. It is critical, has fact chips with sources and as-of dates (`pointsValue` QAR 420.00, rewards ledger, 30 Sep 2026), and leads with **Redeem points first** as a deep link. The same in Arabic. Playwright: Khalid taps the starter question in the Ask AMIL tab, sees the chips, and follows **Redeem points first** to his rewards screen. |
| Refuses investment advice                                                      | ✅ "Should I invest in stocks or gold?" and "هل تنصحني بالاستثمار في الأسهم؟" get the approved refusal with only **Talk to someone**. No customer data is read: the graph skips `fetch_customer_context`, which the unit test asserts. Out-of-scope questions (weather, other banks) get their own refusal. Unit tests also cover the guard blocking model wording that recommends or sells. Playwright covers the typed question.                                                                              |
| Compare views match engine output                                              | ✅ Tested field by field against the packs, in the engine tests and again over the API against the seeded personas: Fatima's settlement dates, Aisha's deposit, and Ravi's payments with his own amount. The cheapest date, its total and the QAR 4,000.00 saving are exactly the `finance.early_settlement` facts. Break now and keep to maturity are exactly the `deposit.break` facts. The minimum option is exactly `card.minimum_payment`. Playwright: Fatima's compare page and Aisha's (Arabic).         |
| Lint, typecheck, tests, build                                                  | ✅ All clean. **1,916 unit and integration tests**: rule-packs 1,300 · gateway 278 · api 129 · db 110 · rules-engine 54 · i18n 28 · widget 16 · ui 1. **16 Playwright tests** (5 new). The compare functions are held at 100% coverage, enforced.                                                                                                                                                                                                                                                               |

## What was built

### Ask AMIL (`apps/api/src/assistant`)

- **The graph (LangGraph.js).**
  `classify_intent → fetch_customer_context → compute → draft_answer → validate_numbers → guard → respond`.
  - Tools are injected, so the graph has no I/O:
    - `getProducts`, `evaluatePack`, `compareScenario`;
    - `latestCharge` / `explainCharge`, `searchProductRules`;
    - `phrase`, for approved copy.
  - Refusals, help and FAQ never read customer data (D-046).
- **The question never reaches a model (D-045).**
  - Intents are classified locally in en and ar: 12 packs, 3 comparisons, explain-a-charge,
    products, help, and refusals.
  - It extracts amounts (including Arabic-Indic digits), months and product hints.
  - "What is ibra?" is answered from the FAQ; "What does a cash withdrawal on **my** card cost?" is
    computed from the customer's own card.
- **Clarifying.**
  - When a question fits several products, it asks which one. Each suggestion carries the topic and
    the product id, never free text.
  - When an action needs an amount, it offers example amounts.
- **Defence in depth (D-048).**
  - The number validator re-checks every answer's text against its facts.
  - The guard blocks selling terms, conventional terms in Islamic answers, and advice phrasing.
    Either one replaces the answer with an approved phrase.
- **Streaming (D-047).** `POST /v1/assistant/messages` is SSE: `status` per step, `delta` with the
  answer text once it has been validated, `answer`, then `done`. Unvalidated model output is never
  streamed.
- **Audit (D-051).**
  - Each turn is one hash-chained event (`rulePackKey: assistant`) holding the question, the
    intent, the checks run and exactly what was shown.
  - The assistant needs the `assistant` consent purpose.

### Compare (`packages/rule-packs/src/compare`, `POST /v1/compare`)

- **Three scenarios.** `settlement_timing`, `min_vs_custom_payment` and `deposit_break_vs_wait`,
  each a pure function built on the pack calculators (D-049). The best option is marked, and each
  option carries its bank deep link.
- **Same gates as a check.** Consent, the underlying pack's kill switch and parameters, and
  approved summary copy (rendered from facts, with no model). Each comparison is audited.

### Copy and knowledge

- **Approved copy.** 68 new templates: Ask AMIL phrases and compare summaries, en/ar, both
  variants. There are now 260 seeded templates in total.
- **FAQ knowledge base** (`packages/rule-packs/knowledge`): 10 topics in English and Arabic,
  compiled into the bundle and figure-free (D-050).
- **A gateway test validates all approved phrase, compare and FAQ copy.** It caught two phrases the
  validator would always have rejected ("pick **one**", Arabic "لست"), which were reworded.

### `<amil-assistant>` and `@amil/sdk`

- **The element.**
  - Starter questions, then answers as they stream, with step indicators.
  - Fact chips, a collapsible "Why am I seeing this?", and comparisons as a table with the best
    option marked.
  - Deep-link options (`amil-option`; it never navigates), suggestions, and the disclosure footer.
  - RTL in Arabic, and a neutral line plus `amil-unavailable` on failure.
- **SDK.** `compare()` and `ask()` (an async iterator over validated SSE events) on both clients,
  plus new scopes `compare:read` and `assistant:chat`.

### Demo bank

- **Ask AMIL tab** hosting `<amil-assistant>` with a session token.
- **Compare pages**, rendered by the bank backend over HMAC:
  - **Compare settlement dates** (finance);
  - **Compare payments** (cards);
  - **Break now or wait?** (deposits).

## Found and fixed during the phase

- **Approved copy the validator rejects** (D-048, above).
- **FAQ language.** An English question from a customer who reads Arabic found no FAQ entry. FAQ
  search now matches either language and answers in the customer's.
- **Intermittent test failures.** API integration files ran in parallel against one database while
  some toggle kill switches. They now run one at a time (D-052).
- **Answer layout** (from the screenshot review). The "why" reasons are now a collapsible list, as
  on the insight card, not paragraphs, and stray blank lines were removed.

## Screenshots

`docs/screenshots/`:

- `phase6-khalid-ask-en.png`
- `phase6-khalid-ask-ar.png`
- `phase6-refusal-en.png`
- `phase6-fatima-ask-compare-en.png`
- `phase6-fatima-compare-en.png`
- `phase6-ravi-compare-en.png`
- `phase6-aisha-compare-ar.png`

## How to run

```bash
pnpm db:migrate && pnpm db:seed
pnpm dev
# http://localhost:3000 → Khalid → Ask AMIL: "What happens if I close my card?";
# type "Should I invest in stocks?"; Fatima → finance → Compare settlement dates.
pnpm --filter @amil/demo-bank build && pnpm --filter @amil/demo-bank e2e
```

## Stubbed or deferred

- **Wording.** With no `ANTHROPIC_API_KEY`, computed answers use the approved template wording
  (offline mock). The model path is the same gateway as checks.
- **Conversation memory.** There is none beyond the turn: each answer is computed from scratch,
  with the conversation id kept for audit. Follow-ups work through suggestions that carry their
  topic and product.
- **Classifier coverage.** It understands the phrasings in its tests (en/ar) and common variants.
  Anything else gets "I'm not sure I understood" with suggestions, never a guess.
- **Rate limiting** of the assistant endpoint is Phase 8.

## Where this work lives

Pushed to the temporary branch **`amil-ai-export`** on NEST (Phases 1–6; no shared history with
NEST). Import it into `amil-ai` with
`git fetch https://github.com/shakiljaved778-ctrl/NEST amil-ai-export && git push origin FETCH_HEAD:refs/heads/main`.

## Open questions for you

1. **Storing the question.** Each turn's audit event keeps the customer's question text (needed
   for complaints review; it stays in the bank's audit store). Keep it, or store only the intent?
2. **Classifier vs model.** In `in_country` mode the bank's own model could classify questions
   (free text would never leave the bank). Worth adding as an option in Phase 8, or keep the
   deterministic classifier everywhere?
3. **Still open:**
   - the number of fact chips on dense cards;
   - demo amount entry;
   - the wording model;
   - mTLS;
   - cashback on closure;
   - where "Talk to someone" goes.
