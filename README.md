# Voyara — the agentic travel company

**An agent with a wallet.** State your trip in one sentence; Voyara plans,
prices with an ML Buy/Wait verdict, books, and then *guards* the trip until
you're home — auto-rebooking on disruption, auto-refunding when prices drop.
Not an OTA with a chatbot.

> Booking.com sells shelf space. Hopper sells fintech. **Voyara sells outcomes.**

This repository contains the **Phase 0** vertical slice: the hotel-only booking
loop, end-to-end, against sandbox suppliers with **zero external keys**.

## The five inversions (product law, expressed in code)

1. **Delegation, not search.** No results pages anywhere. Intent in → one
   assembled trip + two alternates out. → `packages/agent-core/src/pipeline.ts`
2. **Predictive prices.** Every option carries a Buy/Wait verdict + confidence +
   14-day forecast curve. → `packages/forecast`
3. **Book and guard.** A guardian evaluates every live trip and remediates
   within your consent tier. → `packages/guardian`
4. **Zero sponsored results.** Ranking is fit only. There is **no field** in any
   schema where a supplier can pay for position — asserted by a unit test.
   → `packages/agent-core/src/fit-score.ts` + `fit-score.test.ts`
5. **Machine demand.** The booking engine is exposed as MCP rails, billed per
   booking, using the *same* tool definitions as the internal agent.
   → `packages/mcp-rails`

## Quickstart

```bash
pnpm install
cp .env.example .env          # zero external keys required
pnpm exec prisma db push      # SQLite dev db (provider swaps to Postgres)
pnpm db:seed                  # 3 users, a live trip w/ pending guardian events

pnpm test                     # 27 unit tests incl. the Istanbul exit test
pnpm demo                     # runs the exit test in your terminal
pnpm --filter @voyara/web dev # Command Deck → http://localhost:4300
```

### The Phase 0 exit test

Type this one sentence into the Command Deck:

> `3 nights in Istanbul next weekend, boutique, under $150/night, near Sultanahmet`

You get streaming agent narration, **one primary trip + two alternates**, a
Buy/Wait verdict with a forecast curve, an inspectable fit-score "why", and a
working sandbox checkout (compensating saga + double-entry ledger + wallet).

## Architecture

Turborepo + pnpm workspaces. The package boundaries **are** the architecture.

```
apps/
  web/            Command Deck — Next.js 15 App Router, streaming narration
packages/
  contracts/      Zod schemas + tool registry — the single source of truth
  agent-core/     Planner, tool runtime (MONEY gate + audit), pipeline, checkout
  inventory-mesh/ Supplier adapters — mock lodging (54 hotels/6 cities) + air
  forecast/       Buy/Wait verdicts + Price-Freeze underwriting
  ledger/         Double-entry wallet + compensating checkout saga
  guardian/       Trip monitors + remediation (disruption, re-price, ghost)
  mcp-rails/      External MCP server over the shared tool definitions
  ui/             Design tokens (web Tailwind + React Native)
prisma/           Full §3 data model + demoable seed
```

**One tool, three consumers.** Every capability is defined once in `contracts/`
with Zod input/output and flows through a single `ToolRuntime.execute()` that
validates I/O, writes an append-only audit record *before* the side effect, and
hard-gates money-moving tools behind the autonomy tier — in the runtime, never
in the prompt.

## Invariants (enforced mechanically, see `AGENTS.md`)

- **No supplier-margin input to fit scoring.** The scorer accepts only
  `FitScoreInput`; smuggled margin is stripped before it can move a rank.
- **No floats in the ledger.** All money is integer minor units + ISO-4217.
- **Double-entry.** Every movement is two postings that sum to zero; balance is
  derived, never stored as source of truth.
- **Autonomy tiers.** `WATCH` proposes, `ASK` auto-does free/refundable actions,
  `ACT` auto-executes money moves up to a per-user cap.

## Revenue rails wired from day one

Base booking margin (thin net-rate spread), Price-Freeze fees, Voyara+
membership ($99/yr), savings success fee (20% of documented saving), and
per-booking MCP partner fee — all posted through the ledger.

---

_Phase 0 complete. Phase 1 adds flights + Expo Companion + Price-Freeze beta;
Phase 2 the live guardian daemon + rebate loop; Phase 3 MCP GA + admin console._
