# NEST Solutions — Development Roadmap

From the master blueprint and the pre-seed execution plan (MVP → Seed in four quarters).

## Q1 — Build
- MVP customer + provider apps and admin dashboard *(this repo delivers the working MVP product)*
- Booking engine, pricing engine, payment integration (QCB-licensed PSP sandbox)
- Onboard first 40–60 verified providers
- Swap in-memory store for PostgreSQL (prisma/schema.prisma), Redis queues, S3 document storage

## Q2 — Pilot
- Launch 2 Doha zones: West Bay + The Pearl/Lusail, 4–5 hero services
- Basic AI assistant live; gather quality and unit-economics data
- Push notifications, SMS OTP, live WebSocket tracking
- Target: 1,500–3,000 pilot bookings in 90 days, >40% repeat rate

## Q3 — Prove
- Scale to 3–4 zones; Nest+ subscriptions & B2B pilots
- Full AI layer: LLM booking assistant with RAG, complaint classifier, translation, ops insights
- Hit repeat-rate and GMV targets (QAR 500k run-rate)

## Q4 — Raise
- Package traction, close Seed (QAR 4–6M)
- Begin all-Qatar expansion and hiring (CTO month 3, Sales Head month 6)

## Beyond Seed
AI voice & WhatsApp booking · predictive AC maintenance · loyalty & referral engine ·
corporate facility management · annual maintenance contracts · GCC expansion.

## Sprint plan (MVP phase)

| Sprint | Deliverable |
| --- | --- |
| 0 | Architecture, repo, CI/CD, design system, environments |
| 1 | Auth/OTP, roles, language selection, base navigation |
| 2 | Service catalog, packages, admin catalog management |
| 3 | Address/zones, booking quote engine |
| 4 | Scheduling, booking creation, provider availability |
| 5 | Provider jobs: accept/reject, checklist |
| 6 | Payments: intent, confirm, refunds baseline |
| 7 | Admin bookings, manual assignment, provider approval |
| 8 | Notifications, live status, WebSocket tracking |
| 9 | Reviews, complaints, support tickets |
| 10 | AI booking assistant, complaint classifier, AI logs |
| 11 | Arabic RTL, localization QA, performance |
| 12 | Security & payment testing, launch readiness |
