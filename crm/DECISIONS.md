# Engineering decisions

Notable choices made while building the CRM, and the reasoning. Where the
master brief was ambiguous, the industry-standard option was taken and recorded
here.

## Framework & runtime

- **Next.js 15 (App Router) over 14.** The brief said "14+". 15 is the current
  stable, keeps the same App Router model, and has the `serverExternalPackages`
  config we rely on for the mailer.
- **Server Actions for mutations, Route Handlers for machine/public surfaces.**
  Forms and in-app actions call `"use server"` actions (progressive enhancement,
  no bespoke API glue). REST route handlers are used where a non-browser client
  needs them: public lead capture, third-party webhooks, CSV/JSON exports,
  document streaming, global search, and the cron job runner.
- **Layered architecture.** Route/action → **service layer** (`lib/services/*`)
  → Prisma. Actions are thin: parse with Zod, call a service, revalidate. All
  RBAC and business rules live in the service layer so both actions and API
  routes enforce them identically.

## Auth

- **NextAuth v5 (Auth.js) with JWT sessions**, credentials + optional Google
  SSO. JWT (not database sessions) keeps the middleware edge-check cheap and
  avoids a session table.
- **Google SSO never self-provisions.** It only signs in a pre-existing active
  user (matched by email). A CRM's user set is managed by admins, not by
  whoever has a Google account.
- **Lockout, TOTP and audit live inside `authorize()`** so every credential
  attempt — success, failure, lockout, bad 2FA — is recorded and rate-limited
  at the source.
- **TOTP implemented dependency-free** (`lib/crypto.ts`, RFC 6238) rather than
  pulling `otplib`, to keep the dependency surface small and auditable.

## Data model

- **Contact is dual-purpose.** A Contact belongs to an Account (B2B) or stands
  alone as a B2C individual client (`accountId = null`, `clientStatus` set).
  This avoids a separate "individual client" table while still giving B2C
  contacts their own KYC checklist and subscriptions.
- **Money.** `value` is stored as a float in the deal's `currency` with an
  `fxRateToQar` captured at edit time; QAR is the default. Reporting converts to
  QAR via the stored rate so historical figures don't drift with FX. (For a
  bank-grade ledger you'd use integer minor units + a rates table; that's beyond
  this CRM's needs.)
- **Soft-delete everywhere** via `deletedAt`; every scoped query filters it and
  Admin → Recycle bin restores. `AuditLog` is the deliberate exception — it is
  append-only and never deleted.
- **`customFields` as JSON columns** on Lead/Account/Contact/Deal, described by
  `CustomFieldDefinition` rows. Lets admins add fields without migrations; the
  trade-off (no per-field DB constraints) is acceptable for user-defined fields.

## Background jobs

- **DB-backed queue, not BullMQ/Redis.** The brief allowed either; a single
  `Job` table claimed with `UPDATE … FOR UPDATE SKIP LOCKED` needs no extra
  infrastructure, is safe across multiple app instances, and is plenty for
  SLA/renewal/digest cadence. Redis would only be worth it at much higher job
  volume.
- **In-process worker via `instrumentation.ts`, with a cron fallback.** Simple
  for a single deployment; serverless hosts disable it and call
  `POST /api/jobs/run` from a scheduler instead.

## Search

- **Postgres full-text search** with expression GIN indexes over
  leads/accounts/contacts/deals, rather than a separate search service. Fast at
  100k+ rows and keeps everything in one datastore. Raw SQL finds candidate ids;
  the final fetch re-applies RBAC scope through Prisma so search can never leak
  records a user shouldn't see.

## Security & compliance

- **AES-256-GCM for QID/passport**, key from env, ciphertext + `last3` stored
  separately so the list/detail UI can mask without decrypting. Reveal is a
  logged, permissioned server action.
- **Audit trail is append-only by construction** — there is no update/delete
  path to `AuditLog` anywhere in the code (verified: no `auditLog.update|delete`
  calls exist). Sensitive keys (`passwordHash`, `totpSecret`, `nationalIdEnc`)
  are redacted from audit diffs.
- **Rate limiting** on public capture/webhook endpoints (in-memory sliding
  window; swap for Redis when running multiple replicas). A honeypot field traps
  form bots. Security headers set in `next.config.ts`; the embeddable form is
  the one route allowed to be framed.
- **CSRF** is handled by NextAuth for auth flows; app mutations go through
  Server Actions (same-origin, POST-only) rather than open GET endpoints.

## UI

- **shadcn/ui primitives inlined** (Radix + Tailwind) rather than a runtime
  component dependency — matches the brief and keeps styling in the repo.
- **Recharts** for dashboards, with one shared brand-anchored categorical
  palette used consistently across every chart.
- **RTL-ready now, Arabic strings later.** Layout uses logical properties
  (`ps/pe/start/end`) and a `dir` switch driven by locale; `next-intl` is wired
  with English complete and Arabic keys stubbed, so enabling Arabic is a
  translation task, not a re-layout.

## Testing

- **Vitest for pure logic** (encryption, TOTP, routing-rule matching, CSV,
  search-query building) and **Playwright for the critical flows** (login +
  RBAC redirect, lead create→convert→win deal, public capture/webhook).
  Service-layer behaviour that needs the DB (stage moves, conversion, KYC,
  PDPPL export/erase, deactivate-reassign, recurring tasks) was verified against
  a seeded database during development.

## Known trade-offs / future work

- In-memory rate limiting and the in-process worker assume a single app
  instance; both have documented multi-replica upgrades (Redis).
- Custom fields are stored but not yet surfaced as editable inputs on every
  create form (definitions + storage + admin management are in place).
- FX rates are entered per-deal rather than pulled from a live rates feed.
