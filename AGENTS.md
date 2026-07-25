# AGENTS.md — Voyara build invariants

Non-negotiable product law. These are enforced in code and by tests; do not
weaken them.

## The five inversions
1. Delegation, not search — no results pages; intent → 1 primary + 2 alternates.
2. Predictive prices — every option has a Buy/Wait verdict + confidence + curve.
3. Book and guard — every live trip is monitored and remediated within consent.
4. Zero sponsored results — ranking is fit only.
5. Machine demand — the booking engine is MCP-native, billed per booking.

## Hard rules
- **No supplier-margin input to fit scoring.** `fitScore()` accepts only
  `FitScoreInput` (contracts/src/scoring.ts). Any extra key is stripped by the
  Zod parse before the math. Test: agent-core `fit-score.test.ts`.
- **No floats in the ledger, ever.** Money is integer minor units + ISO-4217
  (`Money`, contracts/src/money.ts). Construct only via `money()`.
- **Double-entry.** Every movement is two postings summing to zero
  (ledger/src/ledger.ts). Balance is derived, never stored as source of truth.
- **MONEY gate lives in the runtime, not the prompt.** Tools tagged `MONEY` in
  the registry are gated by autonomy tier + per-user cap inside
  `ToolRuntime.execute()`. Test: agent-core `tool-runtime.test.ts`.
- **Audit before side effect.** `ToolRuntime` appends an audit record before it
  executes a tool. The AuditLog table is append-only.
- **One definition, three consumers.** Tools are defined once in
  `contracts/src/tools.ts` and reused by the internal agent, the API, and MCP
  rails. Do not fork tool schemas.
- **Freeze exposure is capped** (default 15% of fare, config max). Test:
  forecast `engine.test.ts`.

## Repo shape
Turborepo + pnpm. Apps import packages; packages never import from `apps/`.
`packages/contracts` is the single source of truth for types and schemas.

## Quality bar
TypeScript strict, Zod at every boundary, no `any`. Run `pnpm test` and
`pnpm -r run typecheck` before proceeding; do not continue with red tests.
