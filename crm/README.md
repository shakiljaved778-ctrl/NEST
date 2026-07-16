# Fintech Sales CRM — Qatar

A production-grade CRM for a fintech SaaS sales force (50+ users): leads, sales
pipeline, a unified client repository (B2B accounts + B2C individuals),
products & subscriptions, KYC documents, tasks/follow-ups, automatic lead
routing with SLA timers, manager/rep dashboards, and a full admin console —
built for **Qatar / PDPPL** compliance.

> Built with Next.js 15 (App Router, Server Actions + API routes, TypeScript),
> PostgreSQL + Prisma, NextAuth (Auth.js), Tailwind + shadcn/ui, Recharts, Zod,
> Vitest + Playwright.

The application lives in the [`crm/`](.) directory of this repository.

---

## Quick start (local)

Prerequisites: **Node 20+** and **PostgreSQL 14+** (or use Docker, below).

```bash
cd crm
cp .env.example .env          # then edit secrets (see below)
npm install

# generate real secrets
#   AUTH_SECRET:            openssl rand -base64 32
#   FIELD_ENCRYPTION_KEY:   openssl rand -hex 32   (must be 64 hex chars)

npx prisma db push            # create the schema
npm run db:seed               # demo data + prints one login per role
npm run dev                   # http://localhost:3000
```

The seed prints login credentials. All demo users share the password
`Passw0rd!Demo`:

| Role       | Email                | Sees                                            |
| ---------- | -------------------- | ----------------------------------------------- |
| Admin      | `admin@crm.qa`       | Everything + system configuration               |
| Manager    | `manager1@crm.qa`    | All sales data, full dashboards                 |
| Team Lead  | `teamlead1@crm.qa`   | Their team's records                            |
| Sales Rep  | `rep1@crm.qa`        | Their own records + unassigned team records     |
| Read-only  | `compliance@crm.qa`  | Read everything (Compliance/Finance), no writes |

## Quick start (Docker)

```bash
cd crm
docker compose up --build
# Postgres + app; the app applies the schema and seeds demo data on first boot.
# → http://localhost:3000
```

Set `AUTH_SECRET` and `FIELD_ENCRYPTION_KEY` in your shell (or a `.env` next to
`docker-compose.yml`) before `up` for anything beyond a local demo.

---

## Scripts

| Command             | Purpose                                             |
| ------------------- | --------------------------------------------------- |
| `npm run dev`       | Dev server (with in-process background-job worker)  |
| `npm run build`     | Production build (`prisma generate` + `next build`) |
| `npm run start`     | Run the production build                            |
| `npm run db:push`   | Push the Prisma schema to the database              |
| `npm run db:seed`   | Seed demo data                                      |
| `npm run jobs:run`  | Drain the background-job queue once (cron-friendly) |
| `npm run typecheck` | `tsc --noEmit`                                       |
| `npm test`          | Vitest unit tests                                   |
| `npm run test:e2e`  | Playwright E2E (login, lead→convert→win, capture)   |

---

## Environment variables

See [`.env.example`](.env.example) for the full list. The important ones:

| Variable                | Purpose                                                                 |
| ----------------------- | ----------------------------------------------------------------------- |
| `DATABASE_URL`          | Postgres connection string                                              |
| `AUTH_SECRET`           | NextAuth JWT signing secret (`openssl rand -base64 32`)                 |
| `FIELD_ENCRYPTION_KEY`  | 32-byte hex key for AES-256-GCM field encryption (`openssl rand -hex 32`) |
| `STORAGE_DRIVER`        | `local` (dev) or `s3` (any S3-compatible service)                       |
| `S3_*`                  | Bucket/region/credentials when `STORAGE_DRIVER=s3`                      |
| `EMAIL_DRIVER`          | `console` (dev, logs to stdout) or `smtp`                               |
| `SMTP_*`                | SMTP settings when `EMAIL_DRIVER=smtp`                                  |
| `LOCKOUT_MAX_ATTEMPTS`  | Failed logins before lockout (default 5)                               |
| `SESSION_MAX_AGE_HOURS` | JWT session lifetime (default 12h)                                     |
| `GOOGLE_CLIENT_ID/SECRET` | Optional Google SSO (existing users only)                            |
| `JOBS_RUN_TOKEN`        | Bearer token for `POST /api/jobs/run` (serverless cron alternative)     |

---

## Architecture

Clean layered architecture — **route handler / server action → service layer →
Prisma**. Shared Zod schemas validate every input on both client and server.

```
crm/
  app/
    (app)/                 authenticated shell (sidebar, ⌘K search, topbar)
      leads/ deals/ clients/ tasks/ reports/ admin/ my-day/ …
      */actions.ts         "use server" actions → call the service layer
    api/                   route handlers (capture, webhooks, export, docs, jobs, search)
    login/                 credentials + optional Google sign-in
    capture/form/[token]/  public embeddable lead-capture form
  lib/
    auth.ts                NextAuth config (lockout, TOTP, audit on login)
    rbac.ts                server-side scope filters + permission asserts
    audit.ts               append-only audit trail (create + query only)
    crypto.ts              AES-256-GCM field encryption + TOTP (dependency-free)
    storage.ts             S3-compatible storage abstraction (local | s3)
    email.ts               console | smtp email
    jobs.ts                DB-backed job queue + SLA/renewal/digest processors
    services/              leads, deals, clients, documents, reports, routing, admin…
  prisma/schema.prisma     data model
  components/              shadcn/ui primitives + feature components
  e2e/  tests/             Playwright + Vitest
```

### RBAC

Roles: **Admin, Manager, Team Lead, Sales Rep, Read-only**. Every list and
detail query composes a role scope server-side (`lib/rbac.ts`) — the UI never
decides visibility on its own. Reps see their own records plus unassigned
team records; Team Leads see their team; Managers/Read-only see all;
Admin configures the system. Route middleware is defence-in-depth only.

### Background jobs

A DB-backed queue (`Job` table) claimed with `UPDATE … FOR UPDATE SKIP LOCKED`
so workers never double-process. An in-process worker (started from
`instrumentation.ts`) polls every ~15s and runs recurring system jobs:

- **`sla_check`** — flags first-touch SLA breaches, notifies rep + team lead,
  escalates (optionally re-routes) after a configurable delay.
- **`renewal_check`** — 60/30/7-day subscription renewal alerts to the owner.
- **`subscription_expiry`** — marks past-due subscriptions expired.
- **`daily_digest`** — per-rep morning email (new leads, tasks due, overdue).

For serverless deploys, disable the worker (`JOBS_DISABLE_WORKER=true`) and hit
`POST /api/jobs/run` from an external scheduler (guarded by `JOBS_RUN_TOKEN`).

### Global search

Postgres full-text search over expression GIN indexes (`scripts/fts.sql`,
applied by the seed) across leads, accounts, contacts and deals. The ⌘K bar
queries `/api/search`; results are re-scoped through RBAC before display.

---

## Qatar / fintech compliance (PDPPL — Law No. 13 of 2016)

- **Lawful basis / consent** — recorded with a timestamp on every Lead and
  Contact; captured by the public form, import and manual create.
- **Field-level encryption at rest** — QID / passport numbers are encrypted
  with **AES-256-GCM** (`FIELD_ENCRYPTION_KEY`), stored as ciphertext, and
  shown masked (last 3 digits). Revealing the full value is an admin/manager/
  owner action that writes a `REVEAL` **audit** entry.
- **Data export & erasure** — Admins can export a client's full data as JSON
  (QID decrypted for the subject-access request) and **hard-erase** a client
  (right to erasure); the erasure request itself is logged in the audit trail
  before deletion.
- **Immutable audit trail** — append-only `AuditLog`; the service layer exposes
  only create + query (no update/delete API anywhere). Captures actor,
  timestamp, entity, before/after diff for create/update/delete, plus
  sensitive-record views, downloads, reveals, exports, logins and lockouts.
  Browsable/filterable in **Admin → Audit log**.
- **Auth hardening** — password policy, account lockout after N failed
  attempts, session expiry, optional **TOTP 2FA** (enrol in Settings).
- **Localization** — all timestamps stored **UTC**, displayed **Asia/Qatar**
  (UTC+3); currency default **QAR**; English UI with an **RTL-ready** layout
  (logical CSS properties, `dir` switch) and Arabic i18n scaffolded via
  `next-intl` (English complete, Arabic keys stubbed in
  `i18n/messages/ar.json`).
- **No PII in third-party analytics** — the app ships with no external
  analytics; the strict `serverExternalPackages`/self-hosted posture keeps PII
  in your own infrastructure.

### Data residency

Deploy the **database in a Qatar/GCC region** to keep personal data in-country:

- **AWS** — `me-south-1` (Bahrain) or `me-central-1` (UAE); RDS for PostgreSQL.
- **Azure** — **Qatar Central**; Azure Database for PostgreSQL.
- **GCP** — no Qatar region today; prefer AWS/Azure above for residency.

Host the app in the same region, and use a **GCC-region S3 bucket**
(`S3_REGION=me-south-1`) for documents/KYC files. Terminate TLS at the edge and
keep secrets in a managed secret store (never in the image).

---

## Testing

```bash
npm test          # Vitest: crypto/encryption, TOTP, routing rules, CSV, FTS query
npm run test:e2e  # Playwright: login + RBAC, lead create→convert→win, capture API
```

The E2E suite expects a seeded database and a running app (it will start
`npm run start` itself, or set `E2E_NO_SERVER=true` to reuse a running one).

---

## Deployment notes

1. Provision Postgres in a **GCC region** (see Data residency).
2. Set all secrets via env (`AUTH_SECRET`, `FIELD_ENCRYPTION_KEY`, DB URL, S3, SMTP).
3. `npx prisma migrate deploy` (or `db push`) then optionally seed reference data.
4. Build with `BUILD_STANDALONE=true` for a small runtime image (the provided
   `Dockerfile` handles this), or run `npm run build && npm run start`.
5. Either keep the in-process job worker, or run `POST /api/jobs/run` from a
   scheduler every minute (`JOBS_DISABLE_WORKER=true` + `JOBS_RUN_TOKEN`).

See [`DECISIONS.md`](DECISIONS.md) for the notable engineering decisions.
