# Phase 8 report: Hardening and demo

**Status:** complete. This was the last phase in the plan.

## Acceptance criteria

| Criterion                                                              | Result                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| ---------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Full test suite green                                                  | ✅ **1,984 unit and integration tests**: rule-packs 1,317 · gateway 278 · api 168 · db 117 · rules-engine 54 · i18n 28 · widget 17 · ui 5. **23 Playwright tests** (demo bank 16, console 7), now all running under the strict CSP, and failing on any violation. Lint, typecheck, format and build are clean. `pnpm audit --prod`: no known vulnerabilities.                                                                             |
| Fresh clone to running demo in ≤ 3 commands                            | ✅ `git clone …` · `cd amil-ai` · `docker compose up --build`. The one-shot `setup` service migrates, seeds (PII encrypted), adds 30 days of demo traffic on a fresh database and runs today's alerts; then the API, worker, demo bank and console start. A new CI job runs exactly this and smoke-tests the three apps. The setup sequence was also checked against an empty database here, including that a second run adds no traffic. |
| Security headers, encryption at rest, rate limits, CI, Terraform, docs | ✅ See below. `docs/DEMO_SCRIPT.md`, `docs/INTEGRATION_GUIDE.md` and `docs/SECURITY.md` are written.                                                                                                                                                                                                                                                                                                                                      |

## What was built

### Security headers and CSP (D-065)

- **API.**
  - helmet: HSTS, `nosniff`, frame options, referrer policy, COOP/CORP.
  - A deny-all CSP, and `Cache-Control: no-store` on `/v1`.
  - Swagger UI keeps a working policy of its own.
- **Demo bank and console.** A per-request nonce CSP set in Next middleware:
  `script-src 'self' 'nonce-…' 'strict-dynamic'`, `frame-ancestors 'none'`,
  `object-src 'none'`. `connect-src` is limited to the app and, for the demo bank, the AMIL API.
  The apps also send `X-Frame-Options: DENY`, a referrer policy, a permissions policy, and HSTS in
  production.
- **The widget works unchanged under the strict policy.** The integration guide gives banks the one
  directive they need.

### Rate limits (D-064)

- Requests are counted per bank key, per customer session, per console user and per anonymous IP.
  Ask AMIL has a tighter per-session limit. Counters are shared in Redis.
- Over the limit, the API answers `429 rate_limited` with `Retry-After`. The widget treats it as
  unavailable, so the bank flow continues.
- If Redis is down, requests pass rather than fail.

### PII encrypted at rest (D-066)

- **What.** The seven PII columns are AES-256-GCM ciphertext, each bound to its table, column and
  row.
- **Keys.** They come from a key provider: environment keys for the demo, or data keys wrapped by
  the bank's KMS (`kmsKeyProvider`).
- **Rotation.** New values use the newest key, and `pnpm db:rotate-pii` re-encrypts the rest.
- **Who holds the key.** Only the bank side (the seed and the demo bank) does. AMIL's API and
  worker never read these columns.
- **Tests.**
  - Unit tests cover the round trip, tampering, moved ciphertexts, unknown keys, rotation and the
    KMS path.
  - An integration test reads the raw columns and finds no plaintext.

### Least privilege and accountability

- **HMAC keys have a purpose (D-067).** The console's backend has its own key that can only sign
  staff in. The bank app's key cannot.
- **Console activity log (D-068).**
  - It records sign-ins and every look at customer-level data: audit search, event view, export,
    chain verification and complaints lookup.
  - Customer references are kept only as their keyed hash.
  - A new **Console activity** page (admin and compliance) merges it with the approval log.
  - Both logs are now append-only at the database level.

### Supply chain, observability, infrastructure

- **Dependency audit in CI (D-069).** Five transitive advisories were fixed with pnpm overrides:
  `postcss` under Next, and `deepmerge-ts` under the Prisma CLI.
- **OpenTelemetry tracing (D-070).** It is on only when `OTEL_EXPORTER_OTLP_ENDPOINT` is set.
  - Spans: one per request (by route pattern), plus insight preparation, gateway wording and the
    audit append.
  - A test checks that spans carry no customer references, figures or text.
- **Terraform skeleton (D-071).** `infra/terraform` targets GCP `me-central1` (Doha) as one
  project per bank:
  - networking, keys and data: private VPC; KMS keys (PII envelope key and database CMEK);
    Cloud SQL Postgres 16 with private IP, TLS, CMEK and PITR; Memorystore Redis with AUTH and TLS;
  - secrets and services: Secret Manager; Cloud Run api, worker and console, plus a migrate job;
  - one service account per service, each with least privilege.

  CI runs `fmt` and `validate`.

- **Images (D-072).** The API image now carries production dependencies only (423 MB instead of
  the ~1 GB workspace). The demo bank image installs OpenSSL for Prisma.

### Documents

- **`docs/DEMO_SCRIPT.md`**: a 7-minute bank pitch, in this order:
  1. Khalid's card closure (en, then ar);
  2. Fatima's murabaha settlement;
  3. the console (dashboard, complaints lookup, audit, the point-value and kill-switch levers);
  4. the compliance pack.

  It ends with a recovery table.

- **`docs/INTEGRATION_GUIDE.md`** for a bank's app team: credentials and request signing, consent,
  sessions, checks with each action's context, widget embedding (attributes, events, theme, CSP),
  alerts, explain-a-charge, compare, Ask AMIL, product events, errors and limits, and a go-live
  checklist.
- **`docs/SECURITY.md`**: the non-negotiables as controls, then authentication, data protection,
  integrity, input handling, browser security, supply chain, the tests that guard each control,
  and the demo's known limits.

## Found and fixed during the phase

- **Swagger UI over http.** Its CSP asked browsers to upgrade requests to https, which breaks
  `/docs` locally. That directive is now removed for the docs page only.
- **A shared demo key.** The console and the bank app shared one HMAC key, so either could mint
  staff sessions. They now have separate keys with purposes.
- **The approval log could be edited.** It is now append-only, like the audit tables.

- **Found by CI on the first push of this phase**, and fixed:
  - Turbo's strict environment mode did not pass the new variables (the PII key, the console
    key) to test tasks.
  - The slim API image's Prisma client copy assumed a folder that a clean build does not have.
  - The demo bank image generated Prisma's engine for OpenSSL 1.1 but ran on OpenSSL 3. The
    schema now pins the OpenSSL 3 engine.

## Containers: proven in CI

Container images cannot be built in this development sandbox, because package mirrors are
blocked from inside containers. The CI job **Docker demo (compose up)** builds every image, runs
`docker compose up --build`, and smoke-tests the stack:

- the API is ready;
- the demo bank renders the persona list, decrypted from its encrypted records;
- the console sign-in page loads;
- setup loaded the demo traffic and today's alerts.

It is green on CI run 36, together with verify, end-to-end and Terraform.

## Screenshots

`docs/screenshots/phase8-console-activity.png`

## Where this work lives

Pushed to the temporary branch **`amil-ai-export`** on NEST (Phases 1–8; no shared history with
NEST). Import it into `amil-ai` with
`git fetch https://github.com/shakiljaved778-ctrl/NEST amil-ai-export && git push origin FETCH_HEAD:refs/heads/main`.

## Open questions for you

1. **Cloud.** The Terraform skeleton uses GCP Doha. Would your first pilot bank prefer Azure
   Qatar Central or on-premises? The modules map one to one.
2. **mTLS** between the bank and AMIL, in addition to HMAC. Required for pilots, or optional?
3. **Console SSO.** Which identity provider should the console expect first (Entra ID, Okta,
   other)?
4. **Still open from Phase 7:**
   - who may use kill switches;
   - whether pack parameter changes need compliance approval;
   - how "value protected" is defined.
