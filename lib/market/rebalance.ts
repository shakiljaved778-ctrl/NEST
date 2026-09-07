/**
 * Rebalancing heuristics. Rule-based (not advice) — surfaces concentration and
 * diversification nudges from a computed valuation and the user's risk profile.
 * Deliberately simple and transparent; premium unlocks the deeper analytics.
 */
import type {
  PortfolioValuation,
  RebalanceSuggestion,
  RiskTolerance,
} from "@/types/market";

/** Concentration threshold (single position weight) by risk tolerance. */
const SINGLE_POSITION_CAP: Record<RiskTolerance, number> = {
  low: 15,
  medium: 25,
  high: 40,
};

/** Sector concentration cap by risk tolerance. */
const SECTOR_CAP: Record<RiskTolerance, number> = {
  low: 35,
  medium: 50,
  high: 65,
};

export function suggestRebalance(
  v: PortfolioValuation,
  risk: RiskTolerance = "medium",
): RebalanceSuggestion[] {
  const out: RebalanceSuggestion[] = [];
  if (v.rows.length === 0) return out;

  // 1. Single-position concentration.
  const posCap = SINGLE_POSITION_CAP[risk];
  for (const r of v.rows) {
    if (r.weight > posCap) {
      out.push({
        id: `pos-${r.holding.symbol}`,
        severity: r.weight > posCap * 1.5 ? "critical" : "warn",
        title: `${r.holding.symbol} is ${r.weight.toFixed(0)}% of your portfolio`,
        detail: `A single position above ${posCap}% adds concentration risk for a "${risk}" risk profile. Consider trimming ${r.holding.symbol} and redeploying into under-weighted names.`,
      });
    }
  }

  // 2. Sector concentration.
  const secCap = SECTOR_CAP[risk];
  for (const s of v.allocationBySector) {
    if (s.weight > secCap) {
      out.push({
        id: `sec-${s.sector}`,
        severity: s.weight > secCap * 1.3 ? "critical" : "warn",
        title: `${s.weight.toFixed(0)}% concentrated in ${s.label}`,
        detail: `Your portfolio is heavily weighted to ${s.label}. Consider diversifying across other QE sectors to reduce correlated drawdowns.`,
      });
    }
  }

  // 3. Diversification breadth.
  if (v.rows.length < 4 && v.totalValue > 0) {
    out.push({
      id: "breadth",
      severity: "info",
      title: `Only ${v.rows.length} holding${v.rows.length === 1 ? "" : "s"}`,
      detail:
        "Holding fewer than 4 names leaves you exposed to single-stock shocks. A spread of 6–12 positions typically improves risk-adjusted returns.",
    });
  }

  // 4. Cash drag / opportunity.
  const cashWeight =
    v.totalValue + v.cash > 0 ? (v.cash / (v.totalValue + v.cash)) * 100 : 0;
  if (cashWeight > 30) {
    out.push({
      id: "cash",
      severity: "info",
      title: `${cashWeight.toFixed(0)}% sitting in cash`,
      detail:
        "A large idle cash balance can be a drag on long-term returns. Consider phasing it into the market in line with your investment horizon.",
    });
  }

  // 5. Nothing flagged — reassure.
  if (out.length === 0) {
    out.push({
      id: "ok",
      severity: "info",
      title: "Allocation looks balanced",
      detail: `No concentration flags for a "${risk}" risk profile. Keep reviewing as prices move.`,
    });
  }

  return out;
}
