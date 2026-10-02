# AMIL security

How AMIL protects customer data and the bank's integrity: controls, where they live in the code,
and how they are tested. Written for a bank's security, risk and compliance reviewers, with an
OWASP ASVS Level 2 mindset.

> This repository is a demo with synthetic data. Doha Demo Bank is fictional. Demo secrets in
> `.env.example` and `docker-compose.yml` are public and must never be used elsewhere.

## Reporting a vulnerability

Email the AMIL security contact named in your contract (for this demo:
security@amil.example.test) with steps to reproduce. Do not open a public issue. We acknowledge
within 2 business days.

## What AMIL is, and is not, allowed to do

| Principle                           | Enforcement                                                                                                                                                                                                                                                              |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Facts are computed, never generated | Every figure comes from the deterministic rules engine (`packages/rules-engine`, `packages/rule-packs`, decimal arithmetic). A model only rewords approved copy around a fact set.                                                                                       |
| Numbers are validated               | Model output with any number, amount, percentage or date not in the fact set is rejected, including Arabic-Indic digits, invisible characters and spelled-out numbers. The approved template is served instead (`packages/gateway/src/validator.ts`, adversarial tests). |
| Inform, never execute               | AMIL holds no credentials for the bank's core systems. Options are deep links back into the bank's app.                                                                                                                                                                  |
| No selling                          | Banned-term lint over all copy and model output (en/ar), on every draft and approval in the console.                                                                                                                                                                     |
| Consent first                       | No product data is read without an active consent for the purpose (D-019).                                                                                                                                                                                               |
| Data stays in-country               | The model sees only a de-identified fact template (`redacted` mode, fail-closed redactor with property tests), or a model inside the bank (`in_country`), or none (`off`). Ask AMIL never sends the customer's free text to a model (D-045).                             |
| Everything audited                  | Append-only, hash-chained audit log of every evaluation, shown or suppressed (non-negotiable 7).                                                                                                                                                                         |
| The bank approves all copy          | Only approved copy is served; Islamic copy only after Sharia approval.                                                                                                                                                                                                   |
| Kill switches                       | Per pack and per template, effective immediately. The customer sees no insight, never an error.                                                                                                                                                                          |

## Controls

### Authentication and authorisation

- **Bank-to-AMIL calls** use HMAC-SHA256 over timestamp, method, path, body and an optional
  nonce (D-015, D-063):
  - timestamps are accepted within ±5 minutes, and signatures are compared in constant time;
  - each signature is accepted once (Redis replay store).
- **Keys have a purpose** (D-067). A `bank` key cannot sign staff into the console. A `console`
  key can do nothing else.
- **Customer sessions** are 15-minute JWTs (HS256) bound to one customer and to scopes. A
  session can never act for another customer.
- **Console staff** get 8-hour tokens with their own audience and key (D-054):
  - the user and role are re-read on every request;
  - RBAC with segregation of duties: no role both drafts and approves copy (D-055);
  - in the browser, the token stays in an httpOnly, `SameSite=Strict`, `Secure` cookie. A
    same-origin proxy adds it, and rejects writes from other origins.

### Data protection

- **PII encrypted at rest** (D-066):
  - **Which columns:** customer names, phone and email, account numbers, IBANs and card numbers.
  - **How:** AES-256-GCM at the application level, with a random 96-bit IV per value.
  - **Bound to its row:** the authenticated data is the table, column and row id, so a copied
    ciphertext does not decrypt.
  - **Keys:** they come from a key provider. For the demo that is the environment. In
    production it is data keys wrapped by the bank's KMS (envelope encryption).
  - **Rotation:** new values use the newest key, older keys still decrypt, and
    `pnpm db:rotate-pii` re-encrypts under the newest key.
  - **Who holds the key:** AMIL's own services never read these columns and do not hold the key.
- **The audit log never stores the customer reference**, only a keyed HMAC of it (D-009).
  Console searches match by the same hash.
- **In transit:** TLS terminates at the bank's load balancer. The Terraform skeleton enforces
  TLS to PostgreSQL and Redis, and keeps both on private IPs only (D-071).
- **Database encryption:** Cloud SQL uses a customer-managed key in-country (CMEK).
- **Logs** redact `authorization`, cookies and the HMAC headers.
- **Traces** carry route patterns, pack keys and outcomes, never customer references, figures or
  text (D-070).

### Integrity and accountability

- **Audit log:**
  - every evaluation is an `InsightEvent` hash-chained per bank;
  - PostgreSQL triggers reject `UPDATE`, `DELETE` and `TRUNCATE`;
  - the only exception is a retention purge after the retention date (10 years by default,
    D-005);
  - `pnpm audit:verify`, the console and the complaints lookup re-verify the chain.
- **Console accountability** (D-068):
  - every change (pack parameters, kill switches, copy drafts and approvals) is in the
    approval log;
  - every sign-in and every look at customer-level data (audit search, event view, export,
    complaints lookup) is in the console activity log;
  - both logs are append-only at the database level.
- **History is never rewritten.** Pack parameters and copy are versioned: a change creates a new
  version, and the previous one stays (D-056, D-058).

### Input handling and abuse

- **Request validation.** Every request is validated by strict Zod schemas (unknown fields
  rejected; 64 KB body limit). Money is decimal strings, never floats.
- **Generic errors.** Errors are generic codes; internal details are logged, never returned.
- **Rate limits** (D-064): per bank key, customer session, console user and anonymous IP,
  with a tighter limit for Ask AMIL. Counters are shared in Redis.
- **CSV exports** neutralise spreadsheet formulas.

### Browser security

- **API:** helmet headers (HSTS, `nosniff`, frame options, referrer policy, COOP/CORP), a deny-all
  CSP, `Cache-Control: no-store` on `/v1` (D-065), and a CORS allow-list for the bank's app
  origins.
- **Demo bank and console:** a per-request nonce CSP (`script-src 'nonce-…' 'strict-dynamic'`,
  `frame-ancestors 'none'`, `object-src 'none'`), plus `X-Frame-Options: DENY`, a referrer
  policy, a permissions policy and HSTS in production. Every Playwright test fails on any CSP
  violation.
- **Widget:** it needs no inline script and no `eval` (see INTEGRATION_GUIDE.md).

### Supply chain and delivery

- **Dependency audit.** `pnpm audit --prod --audit-level=high` runs in CI. Transitive fixes are
  pinned with pnpm overrides until the parents ship them (D-069).
- **Lockfile.** It is frozen in CI and image builds. Images run as a non-root user. The API image
  contains production dependencies only.
- **CI checks:** format, lint, typecheck, tests, build, both Playwright suites, the Docker demo,
  and Terraform validation.

## Tests that guard these controls

| Control                   | Tests                                                                                        |
| ------------------------- | -------------------------------------------------------------------------------------------- |
| Redaction                 | `packages/gateway` property tests (fast-check): no PII field ever reaches a model payload    |
| Number validator          | `packages/gateway` adversarial suite (Arabic-Indic, full-width, zero-width, spelled numbers) |
| HMAC, replay, nonce       | `apps/api/src/auth/auth.test.ts`                                                             |
| Key purposes, RBAC        | `apps/api/src/phase7.int.test.ts`                                                            |
| Headers, CSP, rate limits | `apps/api/src/app.test.ts`, `packages/ui/src/security.test.ts`, e2e CSP fixture              |
| PII encryption, rotation  | `packages/db/src/pii.test.ts`, `apps/api/src/phase8.int.test.ts`                             |
| Append-only logs          | `packages/db/src/audit-triggers.int.test.ts`, `apps/api/src/phase7.int.test.ts`              |
| Audit chain               | `packages/db` and every API integration suite                                                |
| Tracing without data      | `apps/api/src/telemetry.test.ts`                                                             |

## Known limits of this demo

- **Console sign-in** is a staff picker. A bank puts its SSO (OIDC/SAML via an identity-aware
  proxy) in front of the console backend.
- **Demo-only keys.** The demo uses fixed keys from `.env.example`. A deployment draws every
  secret from its secret manager and its KMS (see `infra/terraform`).
- **mTLS** between the bank and AMIL is not implemented. It is an open question for pilots.
- **Shared database.** AMIL and the demo bank read one database (D-024). In a pilot, AMIL keeps
  its own in-country store, fed by events or a read-only replica.
