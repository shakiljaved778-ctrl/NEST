# Qatar Market Dashboard

A production-ready, Qatar-focused market-data dashboard for retail investors —
built for daily trading, long-term investing, macro monitoring, and portfolio
rebalancing. The UX is a simplified Bloomberg terminal: dark, dense,
keyboard-friendly, and fast.

> **Demo data.** Everything ships with a deterministic mock data layer and is
> clearly labelled “Demo data” in the UI. No external/paid APIs are called.
> A clean adapter layer makes swapping in real providers trivial.

Lives under **`/markets`** so it coexists with the rest of this repository. It
reuses the repo toolchain (Next.js 15 App Router, React 19, TypeScript,
Tailwind, Vitest) and adds **no new npm dependencies** — charts are
dependency-free SVG components behind a swappable abstraction.

---

## Quick start

```bash
npm ci
npm run dev          # http://localhost:4200/markets
```

No environment variables are required for the demo. To run the checks:

```bash
npm run typecheck    # tsc --noEmit
npm test             # vitest (mock data, portfolio math, gating, rebalancing)
npm run build        # production build
```

### Try the flows

1. **Dashboard** — `/markets`. QE index ticker + macro strip up top; market
   overview (index, sector heatmap, gainers/losers/most-active), watchlist,
   portfolio snapshot, GCC comparison and macro previews below.
2. **Auth** — `/markets/login`. Create an account (demo auth, stored in your
   browser) → you’re taken to onboarding.
3. **Onboarding** — pick investment horizon / goal / risk. Stored on your
   profile and used for rebalancing nudges.
4. **Symbol detail** — click any symbol (or press `/` and search). Candlestick +
   volume chart with timeframe switch (1m/5m/15m/1h/1d), SMA indicators, key
   stats, deeper fundamentals (Premium), alerts (Premium), and a demo news feed.
5. **Macro** — `/markets/macro`. QCB policy rate, inflation, GDP for everyone;
   GCC comparison, oil↔QE correlation, money supply & credit for Premium.
6. **Portfolio** — `/markets/portfolio`. Add holdings, see value / P&L /
   allocation, get rebalancing suggestions, and (Premium) advanced analytics.
7. **Freemium** — use the **demo plan toggle** in the account menu (top-right)
   to flip Free ↔ Premium and watch gating, quote delay, and upgrade CTAs change
   live. `/markets/upgrade` shows the plan comparison and a stubbed checkout.

Keyboard shortcuts: `/` focus search · `g d` dashboard · `g m` macro ·
`g p` portfolio · `Esc` close search.

---

## Architecture

```
types/market.ts                 Internal data models (Quote, Bar, MacroSeries, Portfolio…)

services/
  market/
    MarketDataService.ts         The interface the whole app depends on
    MockMarketDataService.ts     Default provider (deterministic mock data)
    RealApiMarketDataService.ts  Provider stub (FMP/Polygon/QSE/QCB) with TODOs
    index.ts                     Factory — picks provider from MARKET_DATA_PROVIDER
    cache.ts                     Cache abstraction (in-memory default, Redis stub)
  analytics.ts                   Analytics interface (console impl; no external calls)

lib/market/
  instruments.ts                 Static universe: QE index/sectors/stocks, GCC, global, macro defs
  generators.ts                  Seeded PRNG + OHLCV / quote / macro generators
  plan.ts                        Freemium feature flags (single source of truth)
  portfolioMath.ts               Pure valuation / P&L / allocation
  rebalance.ts                   Rule-based rebalancing suggestions
  session.ts                     Demo auth + persistence (localStorage)
  api.ts / useAsync.ts           Client fetchers + React-Query-style hook
  usePortfolioValuation.ts       Hook: plan-aware live valuation
  format.ts / http.ts            Formatting + API-route helpers

app/api/market/*                 API routes: overview, quotes, bars, fundamentals,
                                 macro, gcc, global, search, stream (SSE), billing webhook
app/markets/*                    Pages: dashboard, symbol/[symbol], macro, portfolio,
                                 login, onboarding, upgrade
components/market/               charts/ (SVG), ui/ (primitives), panels/, shell/, providers/

prisma/market.schema.prisma      Production Postgres schema (design target)
```

### Swapping in real data

The app only ever talks to the `MarketDataService` interface. To go live:

1. Implement `RealApiMarketDataService` (normalize vendor payloads into the
   internal models — the method bodies have TODOs pointing at suggested
   providers).
2. Set `MARKET_DATA_PROVIDER=real` and the relevant keys (see `.env.example`).
   If a key is missing the factory logs a warning and falls back to mock, so the
   app always renders.

Suggested providers: Financial Modeling Prep / Polygon / Alpha Vantage
(equities & fundamentals), a QSE data partner (Qatar equities), and
QCB reports / data.gov.qa / AllRatesToday QCB FX API (Qatar macro & FX).

### Freemium model

| | Free | Premium |
|---|---|---|
| Quotes | 15-min delayed | Near real-time |
| Streaming | — | SSE (`/api/market/stream`) |
| Chart indicators | 1 | up to 6 |
| Portfolios | 1 | up to 10 |
| Portfolio analytics | Basic P&L | Risk + scenarios |
| Alerts | — | Price / % (in-app) |
| Macro depth | Key indicators | GCC + global |
| Fundamentals | Core stats | EPS, beta, book value |

All gating derives from `lib/market/plan.ts`. The delay is enforced server-side
(quotes carry a `delayed`/`delayMinutes` flag); the UI reads the same flags for
lock overlays and upgrade CTAs.

### Persistence & auth (production)

The demo uses browser `localStorage` (`lib/market/session.ts`) so the freemium
and portfolio flows work with no database. `prisma/market.schema.prisma` is the
production target (Users, OAuthAccount, UserProfile, Subscription, Portfolio,
Holding, WatchlistItem, PriceAlert, SavedLayout, AnalyticsEvent) and its shapes
mirror `types/market.ts`, so wiring **NextAuth** (email/password + OAuth) and
**Prisma** (Neon/Supabase Postgres) later is a drop-in. Caching is behind
`services/market/cache.ts` (in-memory default; Redis/Upstash stub provided).

### Monetization & analytics hooks

- `Subscription` model with trial flags & renewal date (in the Prisma schema).
- Stripe/Paddle **webhook stub** at `app/api/market/billing/webhook` (verify +
  flip subscription — commented, ready to integrate).
- Analytics events (`view_dashboard`, `view_symbol`, `add_holding`,
  `hit_free_limit`, `click_upgrade`, …) via `services/analytics.ts` — logs to the
  console only; no external calls.

### Compliance

Every screen shows the informational-only disclaimer and a “Demo data” marker
where simulated data appears; the footer opens a **Data sources** modal listing
the planned providers (QSE, QCB, PSA, global/GCC).
