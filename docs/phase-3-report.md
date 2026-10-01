# Phase 3 report: Insight API + model gateway

**Status:** complete. Waiting for go-ahead to start Phase 4 (demo bank app + `<amil-insight>` widget).

## Acceptance criteria

| Criterion                                                     | Result                                                                                                                                                                                                                                                                              |
| ------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Redaction property tests pass                                 | ✅ 4 fast-check properties (300 runs each). Synthetic names, emails, phones, IBANs, PANs, account numbers and customer refs never reach the model payload, whether spread into inputs, injected into fact values, smuggled in under extra keys, or placed in the reference wording. |
| Validator rejects injected numbers, incl. Arabic-Indic digits | ✅ 21 adversarial cases are rejected, and every approved template rendered in en/ar with Latin and Arabic-Indic digits is accepted.                                                                                                                                                 |
| Audit chain verifies                                          | ✅ Verified in tests after more than 200 API calls, under 25 concurrent appends, and with tampering detected even when a superuser bypasses the append-only trigger (that test rolls back). `pnpm audit:verify` passes on the dev database.                                         |
| p95 < 400 ms with mock                                        | ✅ Measured over 200 `/v1/checks` calls against PostgreSQL: **p50 29.6 ms, p95 51.5 ms**.                                                                                                                                                                                           |
| Lint, typecheck, tests, build                                 | ✅ All clean. **548 tests** (rule-packs 261, db 83, gateway 80, rules-engine 53, api 43, i18n 28). The API integration and DB tests run against real PostgreSQL.                                                                                                                    |

The adversarial validator cases cover:

- changed, rounded and computed amounts;
- invented percentages and minus signs;
- European digit grouping;
- Arabic-Indic, extended Arabic-Indic and full-width digits;
- digits split with zero-width or bidi characters;
- wrong ISO, d/m/y, English and Arabic dates;
- ordinal numbers and bare years;
- numbers spelled out in English and Arabic.

## What was built

### `packages/gateway`: the model gateway (section 8)

- **Provider interface** `generate({ systemPrompt, factTemplate, locale, maxTokens, timeoutMs })`, with
  three implementations:
  - `AnthropicProvider`: official SDK, `claude-opus-5-5` by default, structured output via Zod,
    effort `low`, no retries.
  - `InCountryProvider`: an OpenAI-compatible endpoint inside the bank's perimeter (stub, tested
    against a fake).
  - `MockProvider`: offline. It returns the approved wording, so the demo needs no key.
- **Redactor** (`buildFactTemplate`) builds the only payload a model sees: facts with display text,
  pack metadata, the approved reference wording, and the Arabic glossary for `ar`. It drops
  identity-like keys, enforces strict value shapes per unit, and fails closed on any PII-shaped
  string (D-022).
- **Number validator**. It normalises NFKC, Arabic-Indic digits and invisible characters. Dates
  must match date facts, other numbers must equal numeric facts, and spelled-out numbers are
  rejected.
- **Output checks**: Zod (headline ≤ 90, body ≤ 280) plus the same copy policy as the templates
  (D-021).
- **Versioned prompt** `prompts/insight.v1.md`, compiled into the bundle. A test fails if the
  generated module is stale.
- **Orchestration** (`ModelGateway.word`):
  - mode `off`, no provider, redaction failure, provider error, rejected output → approved template;
  - past the 1.5 s deadline → the template is served now and the wording finishes in the background
    to warm the cache;
  - a Redis wording cache of 24 hours, keyed by fact template + template version + prompt version
    - model.

### `apps/api`: the insight API (section 7)

- **Auth**:
  - HMAC (`X-AMIL-Key`, `X-AMIL-Timestamp`, `X-AMIL-Signature`) over
    timestamp.method.path.body, a ±5 minute window, single-use signatures held in Redis, and
    constant-time comparison (D-015).
  - Widget sessions are 15-minute HS256 tokens with scopes, minted by `POST /v1/sessions`.
  - A session can only act for its own customer.
- **Endpoints**:
  - `POST /v1/sessions`
  - `POST/GET/DELETE /v1/consents`
  - `POST /v1/checks`
  - `POST /v1/insights/:id/responses`
  - `GET /healthz`, `GET /readyz`
  - `GET /docs` (Swagger UI) and `/docs/json` (OpenAPI 3.1, generated from the same Zod schemas
    that validate requests).
- **`/v1/checks` gates, in order**:
  1. consent (none → generic, data-free card, D-019);
  2. rule-pack kill switch and stored parameters (invalid → suppressed, never computed with);
  3. pure evaluation;
  4. approved and enabled template (Islamic: `sharia_approved` only);
  5. gateway wording;
  6. the card itself: fact chips with labels, sources and as-of dates; options as deep links on the
     bank's scheme; "why" reasons; disclosure (D-018);
  7. hash-chained audit event.

  Any gate that closes returns `200 { kind: "none" }` and is audited with the reason (D-020).

- **Responses**: append-only `CustomerResponse`. A `chose_option` response must name an option that
  was actually shown.
- **Errors**: generic codes only (`bad_request`, `unauthorized`, `forbidden`, `not_found`,
  `internal_error`). Strict schemas reject unknown fields. A customer cannot reach another
  customer's products or insights.

### `packages/sdk`

- Zod contract schemas (with OpenAPI metadata) and inferred types.
- `AmilServerClient` (`@amil/sdk/server`, Node, signs with HMAC).
- `AmilWidgetClient` (browser-safe, session token).

### `packages/db`

- `audit.ts`:
  - canonical JSON and the SHA-256 chain;
  - `appendInsightEvent`, with a per-bank advisory lock so concurrent writers cannot fork the chain;
  - `verifyChain` / `verifyBankChain` (detects edits, deletions and forged hashes; accepts a
    retention-purge anchor);
  - `hashCustomerRef` (keyed HMAC, bank-scoped).
- `writeSeedData`, reused by the CLI seed and by the API test setup.

### Copy added to the packs

- en/ar labels for every declared fact.
- "Why am I seeing this?" sentences for every explanation code the calculators emit.
- Generic no-consent templates for each pack and variant. They are linted as variant-neutral.
- The seed now has **32 templates**.

## Live run (dev database)

The built API was started against PostgreSQL and Redis and called through the SDK:

```
Server client: card.close, Khalid
  critical | Closing this card forfeits 42,000 points (about QAR 420.00)
  | ddb://cards/card_khalid_platinum/rewards ddb://cards/card_khalid_platinum/instalments
    ddb://cards/card_khalid_platinum/close/confirm ddb://support/callback?topic=card.close
Widget client (session, ar): finance.early_settlement, Fatima
  critical | السداد في 20 أكتوبر 2026 بدلاً من اليوم يقلّل ما تدفعه بمقدار 4,000.00 ر.ق
  response chose_option recorded
```

(The dev seed is anchored to the day it ran, so Fatima's cheaper date is still "in 19 days".)

## How to run

```bash
cp .env.example .env                 # includes demo-only HMAC/session/audit secrets
pnpm db:migrate && pnpm db:seed
pnpm dev                             # API on :4000, Swagger UI at http://localhost:4000/docs
pnpm audit:verify                    # verify the audit hash chain
# Optional: ANTHROPIC_API_KEY=... to use Claude for wording; otherwise the offline mock is used.
```

Calling the API from a bank backend:

```ts
import { AmilServerClient } from "@amil/sdk/server";
const amil = new AmilServerClient({
  baseUrl: "http://localhost:4000",
  keyId: "ddb-demo-key",
  secret: "<from .env>",
});
const result = await amil.check({
  action: "card.close",
  customerRef: "DDB-C-0001",
  context: { cardId: "card_khalid_platinum" },
});
```

## Stubbed or deferred

- `InCountryProvider` is exercised only against a fake OpenAI-compatible server.
- `AnthropicProvider` is unit-tested with a fake client. No live Claude call was made: there is no
  key in this environment, and calls cost money. With a key, set `ANTHROPIC_API_KEY`.
- Rate limiting, helmet/CSP, encryption at rest, mTLS and an encrypted credential store are
  Phase 8. CORS is already restricted to `WIDGET_ORIGINS`.
- `/v1/alerts`, `/v1/explain-charge` and `/v1/events` are Phase 5. `/v1/compare` and
  `/v1/assistant/messages` are Phase 6. `/v1/admin/*` is Phase 7.
- Locally, the API integration tests seed the test database themselves. CI uses the same Postgres
  service for both, which is fine because the seed is idempotent and never touches the audit
  tables.

## Where this work lives

As with Phases 1–2, this is pushed to the temporary branch **`amil-ai-export`** on NEST (no shared
history with NEST). Import it into `amil-ai` with
`git fetch https://github.com/shakiljaved778-ctrl/NEST amil-ai-export && git push origin FETCH_HEAD:refs/heads/main`.

## Open questions for you

1. **Cold-cache latency with Claude.** With `claude-opus-5-5`, thinking is always on, so a
   first-time wording will often take longer than the 1.5 s budget. The customer then sees the
   approved template and the model wording is cached for the next identical case. Keep Opus as the
   default, or should the demo deployment use a faster model (for example Claude Haiku 4.5) for
   wording? Both are one env var.
2. **API credentials.** For the pilot, will the bank terminate mTLS in front of AMIL? That decides
   whether Phase 8 adds client-certificate checks in the app or relies on the ingress.
