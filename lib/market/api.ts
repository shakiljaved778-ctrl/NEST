/**
 * Typed client-side fetchers for the market API routes. Each takes the current
 * plan so the server can apply the right quote delay / gating.
 */
import type {
  Bar,
  Fundamentals,
  GccIndex,
  GlobalMacroTile,
  Instrument,
  MacroSeries,
  MarketOverview,
  PlanTier,
  Quote,
  Timeframe,
} from "@/types/market";

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error ?? `Request failed (${res.status})`);
  }
  return res.json() as Promise<T>;
}

export const marketApi = {
  overview: (plan: PlanTier) =>
    getJson<{ overview: MarketOverview; source: string; isMock: boolean }>(
      `/api/market/overview?plan=${plan}`,
    ),

  quotes: (symbols: string[], plan: PlanTier) =>
    getJson<{ quotes: Record<string, Quote>; isMock: boolean }>(
      `/api/market/quotes?symbols=${encodeURIComponent(symbols.join(","))}&plan=${plan}`,
    ),

  bars: (symbol: string, tf: Timeframe, plan: PlanTier) =>
    getJson<{ symbol: string; timeframe: Timeframe; bars: Bar[]; quote: Quote; isMock: boolean }>(
      `/api/market/bars?symbol=${encodeURIComponent(symbol)}&tf=${tf}&plan=${plan}`,
    ),

  fundamentals: (symbol: string) =>
    getJson<{ fundamentals: Fundamentals; instrument: Instrument; isMock: boolean }>(
      `/api/market/fundamentals?symbol=${encodeURIComponent(symbol)}`,
    ),

  macroList: () =>
    getJson<{ series: MacroSeries[]; isMock: boolean }>(`/api/market/macro`),

  macro: (id: string) =>
    getJson<{ series: MacroSeries; isMock: boolean }>(
      `/api/market/macro?id=${encodeURIComponent(id)}`,
    ),

  gcc: () => getJson<{ indices: GccIndex[]; isMock: boolean }>(`/api/market/gcc`),

  global: (plan: PlanTier) =>
    getJson<{ tiles: GlobalMacroTile[]; isMock: boolean }>(
      `/api/market/global?plan=${plan}`,
    ),

  search: (q: string) =>
    getJson<{ results: Instrument[] }>(
      `/api/market/search?q=${encodeURIComponent(q)}`,
    ),
};
