# Pilot preparation report

**Status:** complete.

This is the work after Phase 8:

- applying the answers to the six open questions;
- preparing a pilot bank's deployment on Azure Qatar Central.

The plan's eight phases were already complete.

## The answers, as built

| Question                       | Answer                  | Built as                                                                                                                          |
| ------------------------------ | ----------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| Cloud                          | Azure Qatar Central     | `infra/terraform` rewritten for Azure, a gated deploy workflow, and a runbook (D-073)                                             |
| mTLS                           | Not required for pilots | Recorded with the controls that protect calls without it, and how a bank adds it at its gateway (D-078)                           |
| Console SSO                    | Okta                    | OIDC authorization code flow with PKCE; roles stay in AMIL; the demo picker is off when Okta is configured (D-077)                |
| Who may use kill switches      | Recommended route       | Product, compliance or an admin can turn one off, with a reason; only compliance turns it back on (D-075)                         |
| Parameter changes and approval | Recommended route       | Four eyes: product proposes, compliance approves, never their own proposal, one pending proposal at a time (D-074)                |
| "Value protected"              | Recommended route       | Counts only choices that avoid the loss. Continuing, settling now or asking for a call are not counted as money protected (D-076) |

## Deployment, ready for a bank

- **Terraform for Azure Qatar Central** (`infra/terraform`, D-073), one bank per subscription:
  - every resource is pinned to `qatarcentral`;
  - a VNet with private endpoints, and nothing with a public IP;
  - Key Vault Premium with HSM keys (the PII envelope key and the PostgreSQL CMEK);
  - PostgreSQL 16 with CMEK and backups kept in Qatar;
  - Redis with TLS only;
  - a private registry;
  - internal Container Apps for the api, a single worker and the console, plus the migrate and
    bootstrap jobs;
  - one identity per workload, each scoped to its own secrets;
  - a two-stage first apply, so no app starts before its secrets exist.

  Secrets the bank issues never enter Terraform state.

- **Plan tests.** `terraform test` runs with mocked providers and checks:
  - residency;
  - that stage 1 creates no apps;
  - private-only data stores and registry;
  - that the hosted model key is opt-in;
  - which workload reads which secret.

  A deliberately broken rule was caught. The tests run in CI after `fmt` and `validate`. Locally
  the configuration validates against azurerm 4.81.

- **Ops image** (D-079): a `pnpm deploy` of `@amil/db` with the Prisma CLI and engines, for
  migrations and the bootstrap. The API and worker connect as `amil_app`, which has row access
  and no DDL (`infra/sql/amil_app_role.sql`). Checked here:
  - The bundle migrates a fresh database and runs the bootstrap with no network.
  - All three API integration suites pass as `amil_app` (55 tests), and DDL is refused.
  - CI builds the image and runs both commands against the compose stack.
- **Deploy workflow** (`.github/workflows/deploy-azure.yml`):
  - manual, approved per run through a GitHub environment;
  - Azure sign-in by OIDC, with no stored Azure secret;
  - steps: build and push → plan (summary, or stop there with `plan_only`) → update the jobs →
    migrate → optional bootstrap → roll out the apps.

  `actionlint` is clean.

- **Bank bootstrap** (`pnpm db:bootstrap <config.json>`, D-080). It sets up a real bank from a
  validated config, with no customer data. Packs start switched off and copy starts in review, so
  nothing reaches a customer until the bank has set and approved its terms and copy. Re-running
  adds only what is missing. 13 tests, including a database run.
- **Runbook** (`docs/DEPLOYMENT.md`). It covers:
  - who does what;
  - prerequisites: subscription, state, deploy identity, a runner in the network, GitHub
    environments, Okta, the Application Gateway;
  - the two stages, secrets, and the database role;
  - what must happen in the console before any customer sees AMIL;
  - the data-feed workstream;
  - releases and rollback, operations, and troubleshooting.

## Staff management (D-081)

With Okta, the AMIL staff list decides who may sign in and with which role, so a pilot bank needs
to change it without database access. The console now has a **Staff** page:

- admins add people by their Okta email, change roles, and deactivate or reactivate them;
- compliance can see the list;
- nobody changes their own access;
- the bank always keeps an active compliance officer;
- changes need a reason, apply on the next request, and appear in the console activity log.

## Found and fixed

- **The activity log could hide changes.** When many entries share a timestamp, the merged list
  favoured one log over the other. Same-instant entries are now ordered by id, as the database
  queries do. This showed up in tests, which use a fixed clock.
- **The console's role descriptions** still described the old rules. They now match D-074, D-075
  and D-081.
- **Demo sign-in in the e2e tests** matched any staff member with the role. It now picks the
  seeded demo user, so people added in tests cannot collide with it.
- **An unnecessary type assertion** in the packs API failed lint after a clean reinstall.

## Checks

| Check                | Result                                                                                                                           |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| Unit and integration | ✅ **2,009 tests**: rule-packs 1,317 · gateway 278 · api 175 · db 130 · rules-engine 54 · i18n 28 · widget 17 · console 5 · ui 5 |
| Playwright           | ✅ **28**: demo bank 16, console 12 (including Okta against a mock provider and the staff flow), all under the strict CSP        |
| Static checks        | ✅ format, lint, typecheck, build; `terraform fmt`, `validate`, `test` (5 runs); `actionlint`                                    |
| Containers           | Built in CI only (package mirrors are blocked in the development sandbox). The new ops image step runs there                     |

## What a pilot still needs

These are bank-side items, with steps in DEPLOYMENT.md:

- the Azure subscription and state storage;
- the deploy identity, and a runner inside the network;
- the Okta application;
- the Application Gateway, WAF, DNS and peering;
- the secrets and the bank config.

**The data feed into AMIL's store** (product events or a read-only replica, mapped from the bank's
core systems) is a separate workstream for each bank. Until it runs, checks find no customer and
the bank's flow continues unchanged. Plan it with the bank's data team first: it decides the
pilot date.

The Terraform has been validated and its plan tested, but not yet applied to a real
subscription. The first stage-1 apply in the bank's subscription is the next real test.
