"use client";
import type { MarketOverview } from "@/types/market";
import { fmtSignedPct } from "@/lib/market/format";

/** Sector performance heatmap — tile color/intensity scales with % change. */
export function SectorHeatmap({ sectors }: { sectors: MarketOverview["sectors"] }) {
  const max = Math.max(1, ...sectors.map((s) => Math.abs(s.changePercent)));
  return (
    <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3 lg:grid-cols-4">
      {sectors.map(({ sector, changePercent }) => {
        const intensity = Math.min(0.85, 0.15 + (Math.abs(changePercent) / max) * 0.7);
        const up = changePercent >= 0;
        const bg = up
          ? `rgba(22,199,132,${intensity})`
          : `rgba(234,57,67,${intensity})`;
        return (
          <div
            key={sector.id}
            className="flex flex-col justify-between rounded-md p-2.5"
            style={{ background: bg }}
          >
            <span className="text-[11px] font-semibold leading-tight text-white/90">
              {sector.name}
            </span>
            <span className="num mt-2 text-sm font-bold text-white">
              {fmtSignedPct(changePercent)}
            </span>
          </div>
        );
      })}
    </div>
  );
}
