# Phase 7 report: Bank console

**Status:** complete. Waiting for go-ahead to start Phase 8 (hardening and demo).

## Acceptance criteria

| Criterion                                                             | Result                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| --------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Changing Khalid's point value in the console changes the next insight | ✅ Playwright: the product manager sets `programmePointValueQar` to 0.0125 on Card closure (conventional), reviews the diff and saves version 1.1.1. In the demo bank, Khalid's next card closure reads _"Closing this card forfeits 42,000 points (about QAR 525.00)"_. Clearing the value (version 1.1.2) brings back QAR 420.00 from his rewards ledger. Also covered by an API integration test, and by engine tests (QAR 525.00, fact source `rule_pack`). |
| Disabling `card.close` removes the insight immediately                | ✅ Playwright: the kill switch on the packs page turns off; Khalid's next closure shows only the bank's own "Continue" with no insight card (the API returns `kind: none`, never an error). Turning it back on restores the insight on the next check. An API test covers it too.                                                                                                                                                                               |
| The complaints lookup shows Khalid's history                          | ✅ Playwright: compliance looks up `DDB-C-0001` and sees every insight he was shown, newest first. Each shows its language, headline and body, fact chips with sources and dates, the options offered, and what he chose: the repriced card above shows "Chose an option (Redeem points first)". The audit chain is verified, and each entry links to its audit event, which checks its own hash and its link to the previous event.                            |
| Lint, typecheck, tests, build                                         | ✅ All clean. **1,959 unit and integration tests**: rule-packs 1,317 · gateway 278 · api 155 · db 110 · rules-engine 54 · i18n 28 · widget 16 · ui 1. **23 Playwright tests**: 16 for the demo bank and 7 for the console (new). Both suites run in CI.                                                                                                                                                                                                         |

## What was built

### Console API (`/v1/admin/*`, `apps/api/src/admin`)

- **Sign-in (D-054).** The console's backend lists staff and mints an 8-hour console token over
  the bank's HMAC key. The token is signed with its own key and audience. Every request re-reads
  the user, so a role change takes effect at once.
- **RBAC with segregation of duties (D-055).** Roles are product, compliance, Sharia reviewer,
  admin and viewer. No role both drafts and approves copy. Each route names the permission it
  needs, and the OpenAPI document lists it with the roles that hold it.
- **Rule packs (D-056, D-057).**
  - A parameter change is a new version: validated against the pack's own schema (staff see
    field-level issues), patch version bumped, effective now or later, and the diff written to the
    approval log.
  - The kill switch covers every version, including scheduled ones.
- **Templates (D-058, D-059).**
  - Workflow: product drafts and submits; compliance approves; for Islamic copy, the Sharia
    reviewer gives the final approval. Compliance or the Sharia reviewer can send copy back to
    draft.
  - Checks run on save and on approval: selling and banned terms, Sharia terminology, only
    declared facts, no literal digits, unchanged option keys, and length.
  - Final approval retires the previous version, so only one version is ever served.
  - Live preview renders the draft against demo personas at each severity.
- **Audit and complaints (D-061).**
  - Search by customer reference, matched by its keyed hash.
  - Event view with a hash and link check, and verification of the whole chain.
  - CSV and JSON export, guarded against spreadsheet formula injection.
  - Complaints lookup over the insights actually shown.
- **Dashboard (D-060).** Every figure comes from the audit log:
  - insights by pack and severity, and per day;
  - responses, and reconsidered actions;
  - estimated value surfaced and protected, from each pack's value-at-stake fact;
  - validator rejection rate, and latency p50 / p95.
- **Compliance pack (D-062).** Generated from the running system: model card, data flow, the
  fields each pack reads, a real outbound payload from the redactor, retention and consent.

### Bank console (`apps/console`, :3001)

Next.js 15 and Tailwind v4, with Chart.js for charts. The pages are Dashboard, Rule packs (list
and detail), Templates (list and editor), Audit (search and event), Complaints lookup and
Compliance pack.

- **Pages.** Server components read the API with the signed-in user's token.
- **Interactive parts** (kill switches, parameter editor, template editor and workflow, chain
  check, export) go through a same-origin proxy. The proxy:
  - attaches the token from an httpOnly, `SameSite=Strict` cookie;
  - refuses the sign-in routes;
  - rejects writes from other origins.
- **Navigation.** Each role sees only what it may use, and the API enforces the same rules.

### Also

- **`programmePointValueQar` (D-053).** An optional bank programme parameter on `card.close` and
  `rewards.expiry` (packs 1.1.0). It is what the console changes for the acceptance test, without
  editing the customer's rewards ledger.
- **Demo traffic.** `pnpm --filter @amil/api demo:traffic` writes 30 days of synthetic checks and
  responses through the real pipeline, so the dashboard has data.
- **SDK.** `listConsoleUsers()` and `createConsoleSession()` on the server client, version 0.4.0.

## Found and fixed during the phase

- **Replayed identical requests (D-063).** Two identical signed requests in the same second have
  the same signature, so the replay guard rejected the second. This happened when the console's
  sign-in page was reloaded quickly. Requests can now carry a signed `X-AMIL-Nonce`, and the SDK
  sends one on every call. Requests without a nonce verify as before.
- **Seeded headlines failed re-approval.** The draft length check added together every alternative
  section of a headline. It now measures the longest single reading. The rendered length is
  checked in the preview.
- **Audit event view.** It hashed the row together with its responses, so it errored. It now hashes
  exactly the committed fields.
- **Charge explanations in audit views.** They had no headline. Their name and description are now
  shown.
- **Approval history order.** Entries written at the same instant are now ordered stably.
- **Integration tests.** They now restore the seeded packs and templates, so the order of test
  files does not matter.

## Screenshots

`docs/screenshots/`:

- `phase7-login.png`
- `phase7-dashboard.png`
- `phase7-packs.png`
- `phase7-pack-diff.png`
- `phase7-template-editor.png`
- `phase7-template-checks.png`
- `phase7-audit.png`
- `phase7-audit-event.png`
- `phase7-complaints.png`
- `phase7-compliance.png`

## How to run

```bash
pnpm db:migrate && pnpm db:seed
pnpm --filter @amil/api demo:traffic        # optional: dashboard data
pnpm dev
# http://localhost:3001 → Product manager → Rule packs → Card closure (conventional)
#   → programmePointValueQar 0.0125 → Review → Save; then Khalid closes his card at :3000.
# Compliance officer → Complaints lookup → DDB-C-0001.
pnpm --filter @amil/console --filter @amil/demo-bank build && pnpm --filter @amil/console e2e
```

## Stubbed or deferred

- **Sign-in** is a demo staff picker. A bank would put its SSO (OIDC/SAML) in front of the console
  backend, which already mints the token server-side.
- **Template preview** uses the synthetic personas. A production console would use a
  bank-provided test profile.
- **Console language.** The console is in English. Customer copy is edited and previewed in both
  languages.
- **Phase 8:**
  - rate limits and security headers / CSP, for the console too;
  - encryption at rest;
  - separate HMAC keys for the console backend and the bank app (today they share the demo key).

## Where this work lives

Pushed to the temporary branch **`amil-ai-export`** on NEST (Phases 1–7; no shared history with
NEST). Import it into `amil-ai` with
`git fetch https://github.com/shakiljaved778-ctrl/NEST amil-ai-export && git push origin FETCH_HEAD:refs/heads/main`.

## Open questions for you

1. **Who may use kill switches?** Today product, compliance and admin can. Should it be
   compliance only, or need a second person to confirm?
2. **Four eyes on parameter changes.** Pack parameters take effect when product saves them
   (they are versioned and logged). Should they go through compliance approval like copy?
3. **Value protected.** It counts the value at stake whenever a customer did not continue. Is
   that the measure you want to show banks, or only "chose the loss-avoiding option"?
4. **Still open** from earlier phases:
   - storing Ask AMIL questions;
   - the classifier in `in_country` mode;
   - fact-chip density;
   - the wording model;
   - mTLS;
   - where "Talk to someone" goes.
