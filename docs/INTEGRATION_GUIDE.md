# AMIL integration guide

For a bank's app team. It covers how to:

- mint a customer session from your backend;
- call a pre-action check;
- embed the widget;
- record consent and responses;
- push product events.

Doha Demo Bank (`apps/demo-bank`) is a working reference for every step.

> Everything in this repository is synthetic demo data. Doha Demo Bank is fictional.

## 1. How the pieces fit

```
 Customer's phone                    Your backend                        AMIL (in-country)
 ┌──────────────────────┐   login    ┌────────────────────────┐  HMAC   ┌──────────────────────┐
 │ Your app             │──────────▶ │ mints a 15-min session │───────▶ │ POST /v1/sessions    │
 │  <amil-insight>  ────┼── Bearer ──┼────────────────────────┼───────▶ │ POST /v1/checks      │
 │  (deep links back    │  session   │ (or calls checks itself│  HMAC   │ rules engine → card  │
 │   into your app)     │            │  over HMAC)            │───────▶ │ audit (hash chain)   │
 └──────────────────────┘            └────────────────────────┘         └──────────────────────┘
```

- **Your backend holds the HMAC key.** The browser or app only ever gets a 15-minute session
  token for the signed-in customer.
- **AMIL informs and never executes.** Every option on a card is a deep link into your own flow
  (for example `ddb://cards/{id}/rewards`). Your app navigates; AMIL never moves money or changes
  a product.
- **AMIL never blocks your flow.** When there is nothing to show (no consent, pack switched off,
  not applicable), the API answers `200 { "kind": "none" }`, never an error. If AMIL is
  unreachable, the widget fires `amil-unavailable`. In both cases, show your own "Continue".

The full contract (OpenAPI 3.1, generated from the same Zod schemas that validate requests) is at
`/docs` on the API, for example `http://localhost:4000/docs`.

## 2. Credentials

You get one or more HMAC keys per environment:

| Key purpose | Used by                    | Can call                                      |
| ----------- | -------------------------- | --------------------------------------------- |
| `bank`      | your app backend           | everything under `/v1` except console sign-in |
| `console`   | the AMIL console's backend | `/v1/admin/users`, `/v1/admin/sessions` only  |

Keep keys in your secret store. Never ship them to a browser or mobile app.

### Signing a request

Every server call carries four headers:

| Header             | Value                                                                |
| ------------------ | -------------------------------------------------------------------- |
| `X-AMIL-Key`       | your key id                                                          |
| `X-AMIL-Timestamp` | unix seconds; accepted within ±5 minutes                             |
| `X-AMIL-Nonce`     | a fresh UUID per request (recommended; 16–64 letters, digits or `-`) |
| `X-AMIL-Signature` | hex HMAC-SHA256 of the signing string                                |

The signing string is

```
{timestamp}.{METHOD}.{path with query}.{raw body}.{nonce}
```

The trailing `.{nonce}` is present only when you send a nonce. The raw body is the exact bytes
you send (`""` for GET).

Each signature is accepted once. The nonce lets two identical requests in the same second both
go through.

With the TypeScript SDK (`@amil/sdk/server`) this is done for you:

```ts
import { AmilServerClient } from "@amil/sdk/server";

const amil = new AmilServerClient({
  baseUrl: process.env.AMIL_API_URL!,
  keyId: process.env.AMIL_KEY_ID!,
  secret: process.env.AMIL_KEY_SECRET!,
});
```

In any other language, compute the HMAC as above. The OpenAPI document describes every body.

## 3. Consent first

AMIL reads no product data for a customer until consent is on record. Record consent when the
customer accepts it in your app:

```ts
await amil.grantConsent({
  customerRef: "DDB-C-0001", // your own customer reference
  purpose: "pre_decision_insights", // or proactive_alerts, assistant
  version: "1",
  method: "in_app",
  privacyPolicyVersion: "2026-09",
});
```

To withdraw consent: `amil.withdrawConsent(customerRef, purpose)`. Without consent, a check
returns `kind: "generic"`: product information only, with no customer data read.

## 4. Sessions for the app

After the customer signs in to your app, mint a session on your backend and pass the token to the
app:

```ts
const { token, expiresAt } = await amil.createSession({ customerRef: "DDB-C-0001", locale: "ar" });
```

- **Lifetime.** Tokens last 15 minutes.
- **Scope.** A token is bound to that customer and can act for no one else.
- **Scopes.** Optionally narrow `scopes`: `checks:write`, `insights:respond`, `consents:read`,
  `consents:write`, `alerts:read`, `charges:explain`, `compare:read`, `assistant:chat`.

Also add your app's web origins to AMIL's `WIDGET_ORIGINS` (CORS allow-list).

## 5. Pre-action checks

Call a check just before the customer confirms a consequential action. The widget can do this
itself (section 6); or your backend can call it:

```ts
const res = await amil.check({
  action: "card.close",
  customerRef: "DDB-C-0001",
  context: { cardId: "card_khalid_platinum" },
  locale: "en",
});
// res.kind: "insight" | "generic" | "none"; res.card: headline, body, facts, options, why
```

| Action                     | Context it needs                                         |
| -------------------------- | -------------------------------------------------------- |
| `card.close`               | `cardId`                                                 |
| `card.minimum_payment`     | `cardId` (optional `paymentAmount` to compare)           |
| `card.cash_withdrawal`     | `cardId`, `amount`                                       |
| `card.balance_transfer`    | `cardId`, `amount`                                       |
| `card.epp_conversion`      | `cardId`, `transactionId` (optional `months`, default 6) |
| `finance.early_settlement` | `financeId`                                              |
| `finance.top_up`           | `financeId`, `amount` (optional `months`, default 60)    |
| `deposit.break`            | `depositId`                                              |
| `account.close`            | `accountId`                                              |
| `salary.transfer_change`   | none                                                     |

**Formats.** Amounts are decimal strings in QAR (`"1000.00"`), never JSON numbers.

**Critical cards.** These have `requiresAcknowledgement: true`. Keep your "Continue" disabled
until the customer ticks "I understand" (the widget does this for you).

**Recording the answer.** When the customer answers, record it. This is what the bank's
complaints lookup shows later:

```ts
await amil.respond(res.insightId, { action: "chose_option", optionKey: "redeem_points" });
// actions: continued | chose_option | talk_to_someone | dismissed
```

The widget records responses itself.

## 6. Embedding the widget

`<amil-insight>` is a framework-free web component (Lit, shadow DOM). Load `@amil/widget`, call
`defineAmilInsight()` once, then place the element on the confirmation screen:

```html
<amil-insight
  api-base="https://amil.your-bank.example"
  token="{session token}"
  action="card.close"
  customer-ref="DDB-C-0001"
  card-id="card_khalid_platinum"
  locale="ar"
></amil-insight>
```

- **Context.** For other actions, pass the context as JSON in `context`, for example
  `context='{"depositId":"dep_1"}'`. Alternatively, set the `result` property to a `CheckResponse`
  your backend already has.
- **Events** (on the element, bubbling):

  | Event               | Detail                                                     | What your app does                                        |
  | ------------------- | ---------------------------------------------------------- | --------------------------------------------------------- |
  | `amil-ready`        | `kind`, `severity`, `insightId`, `requiresAcknowledgement` | if `kind` is `none`, show your own Continue               |
  | `amil-option`       | `insightId`, `key`, `deepLink`, `continues`                | navigate to `deepLink` (the response is already recorded) |
  | `amil-acknowledged` | `insightId`                                                | (optional) enable your own Continue                       |
  | `amil-dismiss`      | `insightId`                                                | close the panel                                           |
  | `amil-unavailable`  | none                                                       | show your own Continue; never block the customer          |

- **Theme.** Use CSS variables only: `--amil-primary`, `--amil-primary-contrast`,
  `--amil-surface`, `--amil-surface-muted`, `--amil-text`, `--amil-text-muted`, `--amil-border`,
  `--amil-critical`, `--amil-caution`, `--amil-info`, `--amil-radius`, `--amil-font`.
- **Arabic.** `locale="ar"` lays the card out right to left. The digit style follows the bank's
  setting.
- **Ask AMIL.** `<amil-assistant api-base token customer-ref locale>` is the chat panel. It streams
  validated answers over server-sent events and emits `amil-option` and `amil-unavailable` the
  same way.

### Your page's Content-Security-Policy

The widget needs no inline scripts, `eval` or third-party origins. Allow only the AMIL API in
`connect-src`:

```
connect-src 'self' https://amil.your-bank.example;
```

The demo bank runs with a strict nonce-based CSP (`script-src 'self' 'nonce-…' 'strict-dynamic'`)
and the widget works unchanged under it.

## 7. Other endpoints

| Endpoint                      | What it does                                                                                                                        |
| ----------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `GET /v1/alerts?customerRef=` | Proactive alerts (rewards expiring, account going dormant), computed on AMIL's schedule; `POST /v1/alerts/{id}/read` marks one read |
| `POST /v1/explain-charge`     | Explains a fee line on a statement from your fee schedule                                                                           |
| `POST /v1/compare`            | Side-by-side options: settlement timing, minimum vs custom payment, break a deposit now or wait                                     |
| `POST /v1/assistant/messages` | Ask AMIL (server-sent events)                                                                                                       |

## 8. Product events (webhook-style)

Push product changes from your core systems as they happen:

```ts
await amil.pushEvent({
  idempotencyKey: "txn-2026-10-02-000123", // unique per event
  type: "transaction.posted", // account.updated, card.updated, finance.updated, deposit.updated, customer.updated
  occurredAt: "2026-10-02T08:15:00Z",
  customerRef: "DDB-C-0001",
  payload: { transactionId: "txn_123", amount: "250.00" },
});
```

**Idempotency.** The first delivery returns `201`. A retry with the same key returns `200` with
`duplicate: true`. Retry freely on network errors.

**What happens to events.** In this release they are recorded (in-country) and do not trigger
processing yet (D-043). In a pilot they feed AMIL's own product store, so checks never query your
core systems directly.

## 9. Errors and limits

- **Errors are generic codes**, never internal details: `{ "error": "unauthorized" }`. Codes:

  | Status | Code                             |
  | ------ | -------------------------------- |
  | 400    | `bad_request`, `missing_context` |
  | 401    | `unauthorized`                   |
  | 403    | `forbidden`                      |
  | 404    | `not_found`                      |
  | 429    | `rate_limited`                   |
  | 500    | `internal_error`                 |

- **Rate limits** are per minute and configurable per deployment. Defaults:

  | Limit                  | Default |
  | ---------------------- | ------- |
  | Per bank key           | 6,000   |
  | Per customer session   | 120     |
  | Ask AMIL per session   | 20      |
  | Per console user       | 600     |
  | Unauthenticated per IP | 300     |

  A `429` carries `Retry-After`. The widget treats it like any other failure and fires
  `amil-unavailable`.

- **Caching.** Responses under `/v1` are `Cache-Control: no-store`. Do not cache them in your app
  or CDN.

## 10. Going live checklist

- [ ] HMAC keys stored in your secret manager; separate keys for UAT and production
- [ ] App origins added to `WIDGET_ORIGINS`; the API is behind your load balancer and TLS
- [ ] Consent screen wired to `POST /v1/consents`, including withdrawal
- [ ] Every AMIL placement has your own "Continue" for `kind: none` and `amil-unavailable`
- [ ] Deep links for every option key resolve in your app
- [ ] Copy reviewed and approved in the console (compliance; Sharia for Islamic products)
- [ ] Pack parameters set to your product terms in the console
- [ ] Product events or a read-only replica feeding AMIL's store
