# NEST — Launch Checklist & Iteration Playbook

## 1. Launch checklist (gate to public availability)

### Payments & money
- [ ] PSP sandbox suite passed: card, Apple Pay, Google Pay, wallet
- [ ] Pre-auth → capture-on-completion verified end to end, including partial capture
- [ ] Partial and full refunds verified, webhook replay tested
- [ ] Commission split + provider payout ledger reconciles to the fils
- [ ] Production PSP approved (Qatar Central Bank-licensed) and keys in Secrets Manager
- [ ] VAT-ready e-invoice template validated (Arabic + English)

### Security & compliance
- [ ] OTP rate limits + JWT refresh rotation verified
- [ ] RBAC matrix tested per role (customer / provider / ops / admin / super-admin)
- [ ] KYC documents: KMS encryption at rest, pre-signed upload, no public access
- [ ] OWASP MASVS pass on both mobile apps; API pen test findings closed
- [ ] PDPPL (Law 13/2016) review with Qatar counsel; Arabic terms/privacy/refund live
- [ ] Audit logs on all admin actions; backups restored in a drill this month

### Reliability
- [ ] Load test: 500 concurrent bookings, booking API p95 < 400ms
- [ ] Blue/green deploy + rollback rehearsed; Prisma migrations gated
- [ ] Sentry (mobile + API) and CloudWatch dashboards live
- [ ] Alerts wired: booking-flow errors, payment failures, SLA breaches, AI-gateway down
- [ ] Provider offline mode field-tested in Doha (heat + weak connectivity)

### AI guardrails
- [ ] Red-team suite green: unsafe instructions, prompt injection, Arabic edge cases
- [ ] Emergency-keyword escalation verified in all 6 languages
- [ ] AI audit logging (prompt version on every response) verified
- [ ] Rule-based fallback (`lib/ai.ts` behaviour) kicks in when LLM gateway is down

### Ops readiness
- [ ] 40–60 providers verified, trained, assessed
- [ ] Support control room staffed (bilingual), complaint SLAs configured
- [ ] Manual assignment + dispute flows rehearsed by ops team
- [ ] Pilot scoreboard live and reviewed daily (admin → Pilot scoreboard)

### Stores
- [ ] Store submission kit complete (docs/STORE-SUBMISSION.md)
- [ ] Closed beta (50 users) feedback triaged; crash-free rate > 99.5%
- [ ] Phased rollout plan armed: 10% → 50% → 100%

## 2. Iteration playbook (Phase 7 — the weekly engine)

### Release train
- **Weekly:** EAS OTA update (JS-only fixes and experiments)
- **Biweekly:** store build (native changes), through phased rollout
- Feature flags on anything risky; kill switch per flag

### Analytics
- PostHog/Amplitude with the named event taxonomy:
  `booking_started` · `quote_viewed` · `payment_succeeded` · `rebook_tapped` ·
  `ai_assistant_booked` · `provider_accepted` · `job_completed` · `rating_submitted` ·
  `complaint_filed` · `subscription_started`
- **Weekly funnel review:** kill or fix any step with >20% drop

### Experiments (A/B via feature flags)
Home layout · pricing display (line-item vs. bundled) · AI-assistant entry point ·
rebook card position. One primary metric per experiment, minimum one-week runtime.

### Quality loops
- In-app NPS + store-review prompt after completed bookings (rating ≥4 only)
- **AI eval loop:** weekly grading of 50 assistant transcripts + all safety escalations;
  prompt updates only through the registry (docs/AI-ORCHESTRATION.md)
- Provider quality: weekly review of pros < 4.3 rating → retraining or offboarding

### Cadence
| Rhythm | Ritual |
|---|---|
| Daily | Ops standup on AI daily summary + SLA alerts + pilot scoreboard |
| Weekly | Funnel review · AI transcript grading · release train · provider quality review |
| Biweekly | Sprint boundary: store build, retro, next sprint scope |
| Monthly | Roadmap re-rank against pilot gates · backup restore drill · fraud-rule review |

### Pilot gate reviews (path to Seed)
Every Monday: review the five gates (providers, zones, bookings, repeat rate, GMV run-rate).
For any gate "at risk": name one corrective action with an owner and a date —
supply-side (recruiting, standby pros), demand-side (compound partnerships, community
referral, bilingual ads, coupons), or product-side (funnel fix, rebook prompts).

## 3. Incident response

1. **Detect** — alert fires (booking errors, payment failures, SLA breach, AI down)
2. **Triage** — severity: S1 booking/payment path down · S2 degraded · S3 cosmetic
3. **Mitigate** — feature-flag kill switch, EAS OTA rollback, or blue/green rollback
4. **Communicate** — status to ops room; customer comms for S1 > 15 min
5. **Post-mortem** — blameless, within 48h, action items tracked to closure

Safety incidents (provider/customer harm) bypass this ladder: ops lead + founders
immediately, provider suspended pending review, customer contacted within 1 hour.
