# NEST — Product Requirements Document

**Version 1.0 · Nest Solutions · Doha, Qatar**
**Product:** Qatar's AI-powered trusted home-services super app
**Owners:** Shakil Javed (CEO) · Athar Shadab (COO)

---

## 1. Problem

Booking a trusted home service in Qatar is broken:

- **Fragmented & informal** — word-of-mouth and WhatsApp groups dominate; no single trusted marketplace.
- **Trust & safety gap** — unverified workers enter family homes; no background checks, no accountability.
- **Opaque pricing** — quotes vary wildly; customers negotiate blind and get surprised by final bills.
- **Language barrier** — ~89% of Qatar's ~3.17M residents are expatriates speaking English, Hindi, Urdu, Malayalam or Tagalog; most informal providers operate in one language.

## 2. Solution

One super app, four connected products:

1. **Customer app** — browse, compare, book in ≤5 taps, pay, live-track, chat with AI translation, rate, rebook, subscribe.
2. **Provider app** — KYC onboarding, training, job requests with earnings preview, checklists, photos, earnings dashboard. Offline-first.
3. **Admin & ops dashboard** — live marketplace control room, pilot scoreboard, verification queue, pricing engine, disputes, fraud monitor.
4. **Nest AI layer** — booking assistant, provider matching, dynamic pricing, complaint triage, translation, fraud detection, ops copilot.

## 3. Market & business model

- TAM QAR 10B+ home & personal services · SAM QAR 2.7B on-demand bookable · SOM QAR 176M Year-5 GMV (~6% of SAM).
- Revenue: marketplace commission (15–30% by category), Nest+ customer subscriptions, provider premium subscriptions, B2B/corporate contracts, dynamic/urgency pricing, guarantee & fintech fees.
- VAT-ready from day one (5% VAT expected H2-2026) with compliant e-invoicing.

**Pilot success gates (instrumented in the admin Pilot Scoreboard):**
live MVP · 40–60 verified providers · 2 Doha zones · 1,500–3,000 bookings in 90 days · >40% repeat rate · QAR 500k GMV run-rate → Seed-ready.

## 4. Personas

### Customers

| Persona | Profile | Needs | Key features |
|---|---|---|---|
| **Amina, 38 — Qatari villa household manager** | Al Rayyan villa, family of 7, Arabic-first | Female providers for in-home work, trusted brands, recurring deep cleans | Arabic RTL UI, gender preference, Nest+ villa plan, family profiles |
| **Priya, 31 — Indian expat professional** | The Pearl 1BR, dual income, time-poor | Fast booking, transparent prices, evening slots | ≤5-tap booking, one-tap rebook, Malayalam/Hindi chat translation |
| **James, 45 — Western expat compound resident** | West Bay compound, corporate package | Reliability, receipts, card payment, English service | Verified badges, e-invoices, live tracking, ratings |
| **Fatima, 29 — young Qatari mother** | Lusail apartment, 2 children | Vetted nannies with background checks, safety above all | KYC-verified care providers, safety panel, complaint SLA |

### Providers

| Persona | Profile | Needs | Key features |
|---|---|---|---|
| **Ramesh, 36 — AC technician (India)** | 8 yrs experience, works 6 days/wk | Steady leads, fair commission, fast payouts | Job requests with earnings preview, weekly payouts, quality score |
| **Maria, 33 — cleaner (Philippines)** | Part-time, limited English | Simple UI in Tagalog, offline mode in basements | 6-language provider app, offline-first checklist, photo retry queue |
| **Ahmed, 44 — plumber (Egypt)** | Independent, WhatsApp-based today | More customers without marketing spend | Priority-leads premium tier, ratings that compound |

### Ops

| Persona | Profile | Needs |
|---|---|---|
| **Noor, 27 — ops lead (Doha HQ)** | Runs the pilot control room | Live booking map, SLA alerts, manual assignment, AI daily summary, verification queue |

## 5. Functional requirements

### 5.1 Customer app (23 screens)
Splash → language (6 languages, RTL for AR/UR) → phone OTP → zone selection → home (search, service tiles, quick-rebook, Nest AI entry) → category → service detail → package → add-ons (AI-recommended) → schedule → address (Qatar zone/street/building) → provider matching → confirmation → payment → live tracking with safety panel → auto-translated chat → history → Nest+ plans → rating → complaint/refund → wallet & coupons → profile & family → Nest AI assistant.

- Booking in ≤5 taps: Home → service → package → slot → pay.
- Every screen: default, loading, empty, error, offline states.

### 5.2 Provider app
Onboarding & KYC (QID/passport, work permit) → skills → training + assessment → availability calendar → job requests (ACCEPT/PASS with earnings & commission shown) → job detail → navigation → arrival confirmation → checklist → before/after photos → completion OTP/signature → earnings (QAR, payouts, quality score) → ratings → support. Offline-first: cached jobs, checklist, photo retry queue.

### 5.3 Admin dashboard
Live bookings + manual assignment · **pilot scoreboard (success gates)** · provider verification queue · catalog & pricing engine CRUD · disputes/refunds with AI triage · coupons · demand heatmap + SLA alerts · fraud monitor · AI daily summary · RBAC.

### 5.4 AI layer
| Module | Contract |
|---|---|
| Booking assistant | free text (6 langs) → diagnosis Q&A → service/package recommendation → in-chat booking; hard safety guardrails |
| Provider matching | weighted score: distance .20, availability .20, skill .20, rating .15, completion .10, response .05, language .05, preference .05 |
| Dynamic pricing | peak uplift +10% (17:00–21:00), urgency +QAR 30, Nest+ −10%, coupons; admin-approved bounds |
| Complaint classifier | {late_arrival, poor_quality, damage_claim, safety_concern, payment_issue, provider_behavior, incomplete_job} + priority + sentiment + refund risk + escalation flag |
| Translation | EN⇄AR⇄HI⇄UR⇄ML⇄TL, original + translation stored |
| Fraud detection | fake bookings, collusion, coupon/refund abuse, fake reviews → flags + ops queue |
| Ops copilot | daily summary, demand forecast, shortage alerts |

**AI safety (hard rules):** no DIY electrical/plumbing/AC/pest instructions; no medical advice in care contexts; emergency keywords → human escalation, never a booking; safety/damage/harassment complaints → ops immediately; every AI response logged with prompt version.

## 6. Service catalog

15 launch categories: house cleaning, deep cleaning, plumbing, AC technician, electrical, nanny, cooking, pest control, laundry & ironing, handyman, salon-at-home, appliance repair, moving assistance, car washing, elderly care.
**Pilot launches with 5:** cleaning, deep cleaning, AC, plumbing, electrical.

**Zones:** wave 1 — West Bay, The Pearl, Lusail; wave 2 — Al Sadd, Al Rayyan, Al Wakrah, Msheireb, Al Khor (then Education City, Umm Salal).

## 7. Non-functional requirements

- **Performance:** home screen < 2s TTI on mid-range Android; booking API p95 < 400ms.
- **Availability:** 99.9% booking-path uptime; graceful degradation when AI is down (rule-based fallback — implemented in `lib/ai.ts`).
- **Security & compliance:** OTP + JWT rotation, RBAC, KMS-encrypted KYC, PSP tokenization (no PAN), PDPPL (Qatar Law 13/2016) alignment, Arabic legal docs, VAT-ready invoices, audit logs.
- **Accessibility:** WCAG 2.2 AA, dynamic type, screen-reader labels in 6 languages.
- **Offline:** provider app fully operational offline for active jobs.

## 8. Success metrics

| Metric | Pilot target |
|---|---|
| Verified providers live | 40–60 |
| Pilot bookings (90 days) | 1,500–3,000 |
| Repeat rate | >40% |
| GMV run-rate | QAR 500k |
| Rating average | ≥4.6 |
| Complaint rate | <4% of bookings, all in SLA |
| Booking funnel completion | >60% quote→payment |

Event taxonomy: `booking_started`, `quote_viewed`, `payment_succeeded`, `rebook_tapped`, `ai_assistant_booked`, `provider_accepted`, `job_completed`, `rating_submitted`, `complaint_filed`, `subscription_started`.

## 9. Out of scope (post-Seed)

All-Qatar zones, all 15 services live, corporate/B2B portal, provider academy, WhatsApp + voice booking, predictive AC maintenance, BNPL, insurance-backed guarantee, GCC expansion.
