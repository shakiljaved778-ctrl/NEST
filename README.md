# AMIL AI (عميل)

AMIL is a pre-decision intelligence layer that banks embed in mobile and online banking. When a
customer is about to take a consequential action, such as closing a card, settling finance early,
breaking a deposit or moving their salary, AMIL computes what they will gain or lose from their own
products and the bank's rules. It returns a calm, factual insight card in English or Arabic. The
card's options deep-link back into the bank's own flows.

> **Demo data: Doha Demo Bank is fictional.** Every product parameter, customer and transaction in
> this repository is synthetic.

## Quick start

Requires Node 22, pnpm 10, and PostgreSQL 16 + Redis 7 (via Docker or installed locally).

```bash
cp .env.example .env
docker compose up -d postgres redis
pnpm install && pnpm db:migrate && pnpm db:seed
pnpm dev        # api http://localhost:4000 (Swagger UI at /docs) · demo bank :3000 · console :3001
```

To run the full stack in containers instead: `docker compose up --build`.

Checks: `pnpm lint && pnpm typecheck && pnpm test && pnpm build`. Audit chain: `pnpm audit:verify`.
End-to-end: `pnpm --filter @amil/demo-bank e2e` and `pnpm --filter @amil/console e2e` (Playwright;
they start what they need; build the apps first).

Try it: open http://localhost:3000, pick a persona in the switcher, and switch to Arabic at any time
with the header toggle.

- **Khalid**: Platinum card → **Close card**, **Withdraw cash**, **Convert a purchase to instalments**.
- **Aisha**: her term deposit → **Break deposit** (9 days from maturity).
- **Omar**: Settings → **Move my salary to another bank**.
- **Hessa**: her current account → **Close account** (cheques and standing orders).
- **Ravi**: Gold card → **Pay card**, or **Statement** → tap a fee line to see how it was worked out.
- **Ask AMIL** tab: "What happens if I close my card?" as Khalid; try "Should I invest in stocks?".
- **Compare**: Fatima's finance → **Compare settlement dates**; Aisha's deposit → **Break now or
  wait?**; any card → **Compare payments**.
- **Alerts**: run `pnpm proactive:run` (what the 06:00 schedule does), then open **Alerts** as
  Khalid (points expiring) or Grace (account about to become dormant).

`pnpm worker` runs the proactive packs on their BullMQ schedules.

**Bank console** (http://localhost:3001): pick a staff member. For a filled dashboard, first run
`pnpm --filter @amil/api demo:traffic` (30 days of synthetic checks).

- **Product manager**: Rule packs → Card closure (conventional) → set `programmePointValueQar` to
  `0.0125` → review → save. Khalid's next card closure says QAR 525.00. Flip the pack's kill switch
  and the demo bank shows its own flow with no insight.
- **Product → Compliance → Sharia reviewer**: Templates → edit Islamic copy → save draft → submit;
  sign in as compliance to approve, then as the Sharia reviewer to give the final approval.
- **Compliance officer**: Complaints lookup → `DDB-C-0001` (Khalid): every insight he saw, its
  figures and sources, and what he chose. Audit → search, verify the hash chain, export CSV/JSON.
- **Anyone**: Compliance pack (model card, data flow, fields read, live redaction proof).

Without `ANTHROPIC_API_KEY` the model gateway uses an offline mock that serves the bank-approved
wording, so everything works with no network.

## Layout

| Path                           | What                                                                 |
| ------------------------------ | -------------------------------------------------------------------- |
| `apps/api`                     | Fastify API (checks, alerts, explain-charge, events) + BullMQ worker |
| `apps/demo-bank`               | Doha Demo Bank phone-framed app (Next.js 15)                         |
| `apps/console`                 | Bank staff console (Next.js 15)                                      |
| `packages/db`                  | Prisma schema, migrations, synthetic seed                            |
| `packages/rules-engine`        | Pure TypeScript engine; decimal money and date helpers               |
| `packages/rule-packs`          | The 12 rule packs, conventional + Islamic, with approved en/ar copy  |
| `packages/gateway`             | Model gateway, redactor, number validator                            |
| `packages/i18n`                | en/ar formatting, Arabic-Indic digits, glossary                      |
| `packages/widget`, `sdk`, `ui` | `<amil-insight>` web component, typed API client, shared UI          |

## Docs

- `docs/PLAN.md`: the full checklist and phase status
- `docs/DECISIONS.md`: decisions taken where the brief was ambiguous
- `docs/data-model.md`: schema, conventions and seed
- `docs/phase-N-report.md`: what each phase delivered
- `CLAUDE.md`: non-negotiables, commands and conventions for contributors
