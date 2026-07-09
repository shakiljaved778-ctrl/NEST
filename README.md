# NEST Solutions — Qatar's AI-powered trusted home-services super app

> One app for a trusted home — verified professionals, transparent prices, and AI that books
> the right service in seconds.

This repository contains the working NEST Solutions super app: **one super app, four connected
products**, built from the NEST master blueprint and pitch deck.

| Product | Route | What it includes |
| --- | --- | --- |
| **Customer app** | [`/customer`](http://localhost:4200/customer) | Full interactive phone wireframe: splash → language (6 languages, Arabic/Urdu RTL) → OTP login → zone selection → home → service & packages → add-ons → schedule → address → payment & coupons → AI matching → confirmation → live tracking → chat with AI translation → rating, plus booking history, Nest AI assistant, wallet & coupons, Nest+ subscriptions, complaints/refunds and family profiles |
| **Provider app** | [`/provider`](http://localhost:4200/provider) | Onboarding, KYC documents, skills & tests, availability, job requests with accept/decline, job details, navigation, service checklist, before/after photos, job completion & payout, earnings, ratings/quality score, training academy |
| **Admin & Ops** | [`/admin`](http://localhost:4200/admin) | AI daily summary, KPIs, live bookings table with manual assignment, provider management & verification queue, 15-service catalog manager, dynamic pricing engine & commissions, disputes/refunds with AI triage, coupon campaigns, demand heatmap with SLA alerts, fraud monitor |
| **AI layer** | `/api/ai/*` | Booking assistant (safety-aware routing to the right service), provider matching (weighted scoring), dynamic pricing, complaint classifier, admin daily summary |

## Quick start

```bash
npm install
npm run dev        # http://localhost:4200
```

Production build:

```bash
npm run build && npm start
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
components/             Customer / provider / admin UIs, phone frame
lib/                    Domain layer: catalog (15 services), zones, i18n (6 languages),
                        pricing engine, provider matching, AI modules, in-memory store
prisma/schema.prisma    Production PostgreSQL schema (users, providers, KYC documents,
                        bookings, payments, refunds, complaints, coupons, subscriptions,
                        wallet, chat, notifications, AI logs, fraud flags, audit logs)
docs/                   Architecture, API reference, roadmap
```

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
