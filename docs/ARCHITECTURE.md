# NEST Solutions — Technical Architecture

## Overview

NEST is an AI-native, two-sided marketplace: customers book verified home-service
professionals across 15 services in Qatar. Four connected products share one platform:
customer app, provider app, admin & operations dashboards, and the AI orchestration layer.

## This repository (MVP demo)

A single Next.js application delivers all four products with API route handlers as the
booking engine and an in-memory store. It is intentionally self-contained so the whole
product — screens, navigation, pricing, matching and AI flows — runs with `npm run dev`.

```
Customer app (/customer)   Provider app (/provider)   Admin & Ops (/admin)
        │                        │                          │
        └──────────── Next.js route handlers (/api/*) ──────┘
                             │
        lib/ domain layer: catalog · pricing · matching · AI · store
                             │
                in-memory store  →  prisma/schema.prisma (production)
```

## Production target architecture

```
   Customer App (React Native/Expo)   Provider App (React Native/Expo)   Admin Web (Next.js)
            │                                  │                              │
            └──────────── API Gateway / WAF / Rate limiting ──────────────────┘
                                       │
                              Auth service (OTP + JWT)
                                       │
   ┌───────────────────────────────────────────────────────────────────────┐
   │        NestJS backend — modular monolith, microservice-ready          │
   │  Booking │ Pricing │ Matching │ Payments │ Chat │ Reviews │ Catalog   │
   │  Providers │ Complaints │ Notifications │ Admin │ AI orchestration    │
   └───────────────────────────────────────────────────────────────────────┘
        │            │              │              │                │
   PostgreSQL      Redis        WebSockets        S3           AI Gateway
   (+pgvector)   (BullMQ)     (live tracking,  (KYC docs,    (LLM + RAG +
                               chat)            job photos)   guardrails)
```

### Cloud (AWS)

Route 53 → CloudFront → WAF → ALB → ECS Fargate. RDS PostgreSQL Multi-AZ, ElastiCache
Redis, S3 (KMS-encrypted buckets for KYC), SQS for async jobs, SES/SNS for notifications,
CloudWatch + OpenTelemetry, Secrets Manager, GuardDuty. Environments: dev / staging / prod.

## AI layer

| Module | MVP (this repo) | Production |
| --- | --- | --- |
| Booking assistant | Rule-based intent routing with safety escalation (`lib/ai.ts`) | LLM + RAG over service knowledge base, guardrails, human handoff |
| Provider matching | Weighted scoring: distance 20% · availability 20% · skill 20% · rating 15% · completion 10% · response 5% · language 5% · preference 5% (`lib/providers.ts`) | Same formula + learned re-ranking from booking outcomes |
| Pricing engine | Peak-hour +10%, urgency +QAR 30, coupons, Nest+ −10% (`lib/pricing.ts`) | + demand-based zone uplifts from telemetry |
| Complaint classifier | Keyword classifier with priority, refund risk, escalation (`lib/ai.ts`) | LLM classification with the same JSON contract |
| Ops daily summary | Template over live stats | LLM summarization of marketplace metrics |
| Translation | Pre-translated dictionaries (6 languages) + chat translation demo | Real-time AI translation layer |

### AI safety rules (enforced in all versions)

- Never give DIY electrical / plumbing / AC / pest instructions that could cause harm.
- Emergency keywords (fire, gas, injury) bypass booking and route to humans + Civil Defence guidance.
- Safety, damage, and payment complaints always escalate to the human operations team.
- Every AI output is logged for audit (`AiRecommendation` table in production).

## Security & Qatar compliance

- Phone OTP auth, JWT + rotating refresh tokens, RBAC for admin/ops.
- KYC documents in KMS-encrypted S3, visible only to verification staff.
- Payment tokenization through a QCB-licensed PSP; pre-auth → capture on completion;
  VAT-ready e-invoicing (5% VAT expected H2-2026).
- PDPPL (Qatar Law No. 13 of 2016) alignment: consent, purpose limitation, data minimization.
- Audit logs for all admin actions; API rate limiting; WAF.

## Payments lifecycle

intent → pre-authorize → confirm booking → capture on completion → commission deduction →
provider payable (weekly settlement) → invoice → refunds / partial refunds → fraud monitoring.

## Localization

6 languages (EN / AR / HI / UR / ML / TL), full RTL for Arabic & Urdu, Qatar zone system
addresses, QAR pricing, Arabic-first trust content.
