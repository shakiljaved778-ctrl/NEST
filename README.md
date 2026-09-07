# NEST Solutions — Qatar's AI-powered trusted home-services super app

> One app for a trusted home — verified professionals, transparent prices, and AI that books
> the right service in seconds.

This repository contains the working NEST Solutions super app: **one super app, four connected
products**, built from the NEST master blueprint and pitch deck.

| Product | Route | What it includes |
| --- | --- | --- |
| **Customer app** | [`/customer`](http://localhost:4200/customer) | Full interactive phone wireframe: splash → language (6 languages, Arabic/Urdu RTL) → OTP login → zone selection → home → service & packages → add-ons → schedule → address → payment & coupons → AI matching → confirmation → live tracking → chat with AI translation → rating, plus booking history, Nest AI assistant, wallet & coupons, Nest+ subscriptions, complaints/refunds and family profiles |
| **Provider app** | [`/provider`](http://localhost:4200/provider) | Onboarding, KYC documents, skills & tests, availability, job requests with accept/decline, job details, navigation, service checklist, before/after photos, job completion & payout, earnings, ratings/quality score, training academy |
| **Admin & Ops** | [`/admin`](http://localhost:4200/admin) | AI daily summary, KPIs, **90-day pilot scoreboard (Seed-readiness gates)**, live bookings table with manual assignment, provider management & verification queue, 15-service catalog manager, dynamic pricing engine & commissions, disputes/refunds with AI triage, coupon campaigns, demand heatmap with SLA alerts, fraud monitor |
| **AI layer** | `/api/ai/*` | Booking assistant (safety-aware routing to the right service), provider matching (weighted scoring), dynamic pricing, complaint classifier, admin daily summary |
| **Qatar Market Dashboard** | [`/markets`](http://localhost:4200/markets) | Bloomberg-style, dark market-data terminal for retail investors: QE index/sector/stock quotes & candlestick charts, QCB macro (rates, inflation, GDP, money supply), GCC + global context, portfolio tracker with P&L, allocation & rebalancing, freemium gating (delayed vs live, alerts, advanced analytics), keyboard shortcuts and global search. Runs on a mock data layer behind a swappable adapter — see **[docs/MARKET-DASHBOARD.md](docs/MARKET-DASHBOARD.md)** |

## Quick start

```bash
npm install
npm run dev        # http://localhost:4200
```

### Deploy the Qatar Market Dashboard to Vercel (one click)

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/shakiljaved778-ctrl/NEST/tree/claude/qatar-market-dashboard-ao73ez&project-name=qatar-market-dashboard&repository-name=qatar-market-dashboard)

No environment variables required — it runs on mock data and calls no external
APIs. After deploy, open **`/markets`** on your Vercel URL. See
[docs/MARKET-DASHBOARD.md](docs/MARKET-DASHBOARD.md#deploy-one-click) for details.

Production build:

```bash
npm run build && npm start
```

Verify (same as CI — `.github/workflows/ci.yml` runs this on every push):

```bash
npm run typecheck && npm test && npm run build
```

## Project structure

```
app/                    Next.js App Router
  page.tsx              Landing / product overview
  customer/             Customer app (interactive phone wireframe)
  provider/             Provider app (interactive phone wireframe)
  admin/                Admin & operations dashboard
  api/                  Booking engine + AI layer (route handlers)
    catalog/            GET  /api/catalog
    quote/              POST /api/quote          — pricing engine
    match/              POST /api/match          — AI provider matching
    bookings/           GET/POST /api/bookings, GET/PATCH /api/bookings/:id
    ai/assistant/       POST /api/ai/assistant   — AI booking assistant
    ai/complaint/       POST /api/ai/complaint   — AI complaint classifier
    admin/summary/      GET  /api/admin/summary  — stats + AI daily summary
    admin/pilot/        GET  /api/admin/pilot    — pilot scoreboard (Seed gates)
components/             Customer / provider / admin UIs, phone frame
lib/                    Domain layer: catalog (15 services), zones, i18n (6 languages),
                        pricing engine, provider matching, AI modules, pilot scoreboard,
                        in-memory store
prisma/schema.prisma    Production PostgreSQL schema (users, providers, KYC documents,
                        bookings, payments, refunds, complaints, coupons, subscriptions,
                        wallet, chat, notifications, AI logs, fraud flags, audit logs)
tests/                  Vitest unit suites: pricing, matching, AI, booking store, pilot
docs/                   PRD & personas, design system, architecture, API reference,
                        OpenAPI spec, AI orchestration & prompt registry, store
                        submission kit (EN/AR), launch checklist & iteration playbook,
                        roadmap
```

## Documentation

| Doc | Contents |
| --- | --- |
| [`docs/PRD.md`](docs/PRD.md) | Product requirements, personas, success metrics |
| [`docs/DESIGN-SYSTEM.md`](docs/DESIGN-SYSTEM.md) | Brand tokens, typography, RTL, accessibility |
| [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) | Production cloud architecture (AWS me-central) |
| [`docs/API.md`](docs/API.md) · [`docs/openapi.yaml`](docs/openapi.yaml) | API reference + OpenAPI 3.1 spec |
| [`docs/AI-ORCHESTRATION.md`](docs/AI-ORCHESTRATION.md) | AI service design + versioned prompt templates |
| [`docs/STORE-SUBMISSION.md`](docs/STORE-SUBMISSION.md) | App Store / Play listing kit, EN + AR |
| [`docs/LAUNCH-PLAYBOOK.md`](docs/LAUNCH-PLAYBOOK.md) | Launch checklist, iteration engine, incident response |
| [`docs/ROADMAP.md`](docs/ROADMAP.md) | Phase plan through scale |

## Design language

Navy `#12294B` · Gold `#C9A227` · Teal `#0F9D8A` · Pearl `#F5F7FB` — serif display headings and
card-based layout matching the NEST investor deck. Full RTL support for Arabic and Urdu.

## Demo notes

- Data persists in-memory per server process; production swaps `lib/store.ts` for PostgreSQL via
  `prisma/schema.prisma`.
- The AI modules are deterministic rule-based MVP versions of the production LLM pipeline
  (orchestration + RAG + guardrails + human handoff) described in `docs/ARCHITECTURE.md`.
- Try coupon codes `NEST10`, `SALAM15`, `PEARL25` at checkout, and ask Nest AI
  “My AC is not cooling”.

— NEST Solutions · Doha, Qatar · Founders: Shakil Javed (CEO), Athar Shadab (COO)
