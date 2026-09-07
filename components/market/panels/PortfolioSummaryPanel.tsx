"use client";
import Link from "next/link";
import { useAppState } from "@/components/market/providers/AppState";
import { usePortfolioValuation } from "@/lib/market/usePortfolioValuation";
import { Panel } from "@/components/market/ui/Panel";
import { KpiCard } from "@/components/market/ui/KpiCard";
import { DonutChart } from "@/components/market/charts/DonutChart";
import { ChangePill } from "@/components/market/ui/ChangePill";
import { fmtQar, fmtSignedPct, fmtCompact } from "@/lib/market/format";

/** Compact portfolio snapshot for the dashboard home. */
export function PortfolioSummaryPanel() {
  const { user, plan, portfolios } = useAppState();
  const portfolio = portfolios[0] ?? null;
  const { valuation } = usePortfolioValuation(portfolio, plan);

  if (!user) {
    return (
      <Panel title="Portfolio">
        <div className="flex h-full flex-col items-center justify-center gap-2 py-6 text-center">
          <p className="text-xs text-terminal-muted">
            Sign in to track holdings, P&amp;L and allocation.
          </p>
          <Link href="/markets/login" className="t-btn-accent">
            Sign in
          </Link>
        </div>
      </Panel>
    );
  }

  if (!portfolio || portfolio.holdings.length === 0) {
    return (
      <Panel
        title="Portfolio"
        actions={
          <Link href="/markets/portfolio" className="t-btn">
            Open tracker
          </Link>
        }
      >
        <div className="flex h-full flex-col items-center justify-center gap-2 py-6 text-center">
          <p className="text-xs text-terminal-muted">
            No holdings yet. Add your first position to see value, P&amp;L and allocation.
          </p>
          <Link href="/markets/portfolio" className="t-btn-accent">
            Add holdings
          </Link>
        </div>
      </Panel>
    );
  }

  const v = valuation!;
  return (
    <Panel
      title={`Portfolio — ${portfolio.name}`}
      actions={
        <Link href="/markets/portfolio" className="t-btn">
          Manage
        </Link>
      }
    >
      <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          <KpiCard label="Value" value={fmtQar(v.totalValue, 0)} />
          <KpiCard
            label="Total P&L"
            value={fmtSignedPct(v.pnlPercent)}
            sub={fmtQar(v.pnl, 0)}
            accent={v.pnl >= 0 ? "up" : "down"}
          />
          <KpiCard
            label="Day"
            value={<ChangePill changePercent={v.dayChangePercent} size="md" />}
            sub={fmtQar(v.dayChange, 0)}
            accent={v.dayChange >= 0 ? "up" : "down"}
          />
        </div>
        {v.allocationBySector.length > 0 && (
          <DonutChart
            size={150}
            slices={v.allocationBySector.map((a) => ({ label: a.label, value: a.value }))}
            centerValue={fmtCompact(v.totalValue)}
            centerLabel="QAR"
          />
        )}
      </div>
    </Panel>
  );
}
