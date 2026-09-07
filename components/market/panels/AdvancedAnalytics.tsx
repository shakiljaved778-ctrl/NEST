"use client";
import type { PortfolioValuation, SectorId } from "@/types/market";
import { Panel } from "@/components/market/ui/Panel";
import { KpiCard } from "@/components/market/ui/KpiCard";
import { fmtNumber, fmtQar, fmtSignedPct } from "@/lib/market/format";

/**
 * Premium analytics — deliberately a transparent STUB (clearly labeled). Uses
 * fixed sector sensitivities to illustrate risk metrics and scenario analysis;
 * swap in a real factor model when historical returns are available.
 */

// Illustrative sector sensitivities (elasticity to a +1% move in the factor).
const OIL_BETA: Record<SectorId, number> = {
  industrials: 0.9,
  transport: 0.6,
  banks: 0.3,
  realestate: 0.25,
  insurance: 0.2,
  consumer: 0.15,
  telecoms: 0.1,
};
const RATE_BETA: Record<SectorId, number> = {
  banks: 0.5,
  insurance: 0.3,
  realestate: -0.6,
  industrials: -0.2,
  consumer: -0.15,
  transport: -0.2,
  telecoms: -0.1,
};

function weightedFactor(v: PortfolioValuation, table: Record<SectorId, number>): number {
  let sum = 0;
  for (const s of v.allocationBySector) {
    sum += (s.weight / 100) * (table[s.sector] ?? 0);
  }
  return sum;
}

export function AdvancedAnalytics({ valuation }: { valuation: PortfolioValuation }) {
  // Herfindahl concentration index (0 = diversified, 1 = single position).
  const hhi = valuation.rows.reduce((s, r) => s + (r.weight / 100) ** 2, 0);
  const effectiveN = hhi > 0 ? 1 / hhi : 0;
  const top = valuation.rows[0];

  const oilBeta = weightedFactor(valuation, OIL_BETA);
  const rateBeta = weightedFactor(valuation, RATE_BETA);

  const scenarios = [
    { label: "Brent −10%", impactPct: oilBeta * -10 },
    { label: "Brent +10%", impactPct: oilBeta * 10 },
    { label: "QCB rate +50bps", impactPct: rateBeta * 0.5 },
    { label: "QCB rate −50bps", impactPct: rateBeta * -0.5 },
  ];

  return (
    <Panel
      title="Advanced Analytics"
      actions={<span className="t-chip bg-terminal-warn/15 text-terminal-warn">★ Premium · stub</span>}
    >
      <div className="grid gap-3 lg:grid-cols-2">
        <div>
          <div className="mb-2 t-title">Risk metrics</div>
          <div className="grid grid-cols-2 gap-2">
            <KpiCard
              label="Concentration (HHI)"
              value={fmtNumber(hhi, 2)}
              sub={hhi > 0.25 ? "Concentrated" : "Diversified"}
              accent={hhi > 0.25 ? "down" : "up"}
            />
            <KpiCard label="Effective holdings" value={fmtNumber(effectiveN, 1)} />
            <KpiCard
              label="Largest position"
              value={top ? `${fmtNumber(top.weight, 0)}%` : "—"}
              sub={top?.holding.symbol}
            />
            <KpiCard label="Oil sensitivity β" value={fmtNumber(oilBeta, 2)} />
          </div>
        </div>

        <div>
          <div className="mb-2 t-title">Scenario analysis</div>
          <table className="w-full text-xs">
            <tbody>
              {scenarios.map((s) => {
                const impactValue = (valuation.totalValue * s.impactPct) / 100;
                return (
                  <tr key={s.label} className="border-t border-terminal-border/60">
                    <td className="px-2 py-1.5 text-terminal-text">{s.label}</td>
                    <td
                      className={`num px-2 py-1.5 text-right ${s.impactPct >= 0 ? "text-terminal-up" : "text-terminal-down"}`}
                    >
                      {fmtSignedPct(s.impactPct)}
                    </td>
                    <td
                      className={`num px-2 py-1.5 text-right ${impactValue >= 0 ? "text-terminal-up" : "text-terminal-down"}`}
                    >
                      {fmtQar(impactValue, 0)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <p className="mt-2 text-[10px] text-terminal-muted">
            Illustrative sensitivities, not a forecast. Real factor model to follow.
          </p>
        </div>
      </div>
    </Panel>
  );
}
