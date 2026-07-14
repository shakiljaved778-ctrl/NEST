# Personal Growth Agent

> Your daily accountability coach across six tracks: **career growth, LinkedIn presence,
> book reading, fitness & weight loss, AI learning, and finance building** — with daily
> email updates to **shakil.mdj@outlook.com**.

This is a **standalone project** (its own `package.json`, no dependency on the NEST app).
To split it into its own repository later, copy this folder as-is.

## What the agent does

| Track | How it monitors & coaches |
| --- | --- |
| 🚀 Career growth | One deliberate career action per day, rotated from your founder-focus list (investor-readiness, thought leadership, fundraising, operating cadence) |
| 💼 LinkedIn | Tracks daily posts + engagements, suggests a founder-angle post idea every day, and **scores any post you paste** (hook, structure, specifics, CTA, hashtags) |
| 📖 Reading | Nudges one important chapter a day from a curated library (Atomic Habits, 7 Habits, Deep Work, Psychology of Money, Mindset, The Lean Startup) with the key takeaway |
| 💪 Fitness & weight | Workout minutes vs target, weigh-in trend vs your kg/week pace, distance to target weight |
| 🤖 AI learning | A 14-step AI-builder curriculum (prompting → RAG → agents → shipping); serves the next lesson based on sessions completed |
| 💰 Finance | Daily savings vs weekly target, plus a rotating finance habit tip |

Every day gets a **0–100 score**, per-track and overall **streaks**, 14-day score and
30-weigh-in **trend charts**, and a **daily briefing** (headline, motivation, six-track plan).

## Quick start

```bash
cd growth-agent
npm install
npm run dev        # http://localhost:4300
```

Verify:

```bash
npm run typecheck && npm test && npm run build
```

Tabs: **Today** (dashboard) · **Check-in** (2-minute daily log) · **Coach** (daily briefing +
email button) · **Library** (books & AI curriculum) · **Goals** (edit every target, your
name, and the update email).

## Email updates (Outlook)

The digest email is sent by `POST /api/digest` to the address saved on the Goals tab
(default `shakil.mdj@outlook.com`). Configure SMTP once via environment variables —
create `growth-agent/.env.local`:

```bash
SMTP_HOST=smtp-mail.outlook.com
SMTP_PORT=587
SMTP_USER=your-sending-address@outlook.com
SMTP_PASS=your-app-password        # Outlook: Account > Security > App passwords
DIGEST_FROM=your-sending-address@outlook.com
```

Notes:
- Microsoft requires an **app password** (or OAuth) — your normal password won't work
  if two-step verification is on. Any other SMTP provider (Gmail, Resend, SendGrid SMTP)
  works with the same four variables.
- Without SMTP configured, the "Email me today's digest" button still shows a full
  preview of the email that would be sent.

### Automate the daily email

The app mirrors your check-ins to a file-backed store (`data/store.json`), so the server
can build the digest on its own. With the app running, schedule a daily cron (e.g. 7:00):

```cron
0 7 * * * curl -s -X POST http://localhost:4300/api/digest
```

On a host like Vercel, point a scheduled job / Vercel Cron at `GET /api/digest`.

## Upgrading the coach to a real LLM

The coach is rule-based (free, offline, deterministic). The contract is
`CoachEngine` in `lib/types.ts`; the app obtains it from `getCoach()` in `lib/coach.ts`.
To upgrade: implement `CoachEngine` with a Claude API call (model `claude-sonnet-5` is a
good default), return it from `getCoach()`, and nothing else changes — the briefing UI,
email digest, and post review all flow through the same interface.

## Project structure

```
app/            Next.js App Router (port 4300)
  page.tsx        Tabbed app shell (Today / Check-in / Coach / Library / Goals)
  api/data/       GET/POST file-backed store (mirrors browser data for the cron)
  api/digest/     POST/GET builds + emails the daily digest
components/     Dashboard, CheckinForm, CoachPanel, GoalsForm, Library, TrendChart, ui
lib/            Domain layer (pure, fully tested)
  types.ts        Goals, DailyCheckin, CoachEngine contract, six tracks
  scoring.ts      Day scores, streaks, weekly summary, weight trend
  coach.ts        RuleBasedCoach (briefing + LinkedIn post review)
  emailDigest.ts  Renders the daily digest email (text + HTML)
  books.ts        Curated chapter library · curriculum.ts  AI lessons ·
  linkedin.ts     Post ideas · storage.ts  localStorage + server sync ·
  serverStore.ts  File-backed store · defaults.ts  Seed goals
tests/          Vitest suites: scoring, streaks, coach, digest (22 tests)
```

Data lives in your browser's localStorage (source of truth) and is mirrored to
`data/store.json` so scheduled emails work; no external database needed.
