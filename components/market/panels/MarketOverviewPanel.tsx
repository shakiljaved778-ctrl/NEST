"use client";
import { useState } from "react";
import { useAppState } from "@/components/market/providers/AppState";
import { marketApi } from "@/lib/market/api";
import { useAsync } from "@/lib/market/useAsync";
import { Panel } from "@/components/market/ui/Panel";
import { ChangePill } from "@/components/market/ui/ChangePill";
import { DemoBadge } from "@/components/market/ui/DemoBadge";
import { SkeletonRows } from "@/components/market/ui/Skeleton";
import { SectorHeatmap } from "./SectorHeatmap";
import { MoversTable } from "./MoversTable";
import { fmtNumber, fmtTime } from "@/lib/market/format";

type Tab = "gainers" | "losers" | "active";

export function MarketOverviewPanel() {
  const { plan } = useAppState();
  const [tab, setTab] = useState<Tab>("gainers");
  const { data, loading } = useAsync(() => marketApi.overview(plan), [plan], {
    refetchInterval: plan === "premium" ? 5000 : 30000,
  });

  const o = data?.overview;
  const rows =
    o && (tab === "gainers" ? o.gainers : tab === "losers" ? o.losers : o.mostActive);

  return (
    <div className="grid gap-3 lg:grid-cols-2">
      {/* QE index + sector heatmap */}
      <Panel
        title="Market Overview — Qatar (QE)"
        actions={<DemoBadge isMock={data?.isMock ?? true} />}
      >
        {loading && !o ? (
          <SkeletonRows rows={4} />
        ) : o ? (
          <div>
            <div className="mb-3 flex items-end justify-between gap-3">
              <div>
                <div className="text-[11px] text-terminal-muted">{o.index.name}</div>
                <div className="num text-2xl font-bold text-terminal-bright">
                  {fmtNumber(o.index.price, 2)}
                </div>
                <ChangePill
                  change={o.index.change}
                  changePercent={o.index.changePercent}
                  showAbs
                  size="sm"
                />
              </div>
              <div className="text-right text-[10px] text-terminal-muted">
                <div>Vol {fmtNumber(o.index.volume, 0)}</div>
                <div>
                  {o.index.delayed ? `Delayed ${o.index.delayMinutes}m · ` : "Live · "}
                  {fmtTime(o.asOf)}
                </div>
              </div>
            </div>
            <div className="mb-1 t-title">Sector performance</div>
            <SectorHeatmap sectors={o.sectors} />
          </div>
        ) : (
          <p className="p-3 text-xs text-terminal-muted">No data.</p>
        )}
      </Panel>

      {/* movers */}
      <Panel
        title="QE Movers"
        actions={
          <div className="flex gap-1">
            {(["gainers", "losers", "active"] as Tab[]).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`rounded px-2 py-1 text-[10px] font-semibold uppercase tracking-wide ${
                  tab === t
                    ? "bg-terminal-accent/20 text-terminal-bright"
                    : "text-terminal-muted hover:text-terminal-text"
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        }
        bodyClassName="p-1.5"
      >
        {loading && !rows ? (
          <SkeletonRows rows={5} />
        ) : rows ? (
          <MoversTable rows={rows} />
        ) : null}
      </Panel>
    </div>
  );
}
