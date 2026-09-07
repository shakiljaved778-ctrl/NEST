"use client";
import { marketApi } from "@/lib/market/api";
import { useAsync } from "@/lib/market/useAsync";
import { Panel } from "@/components/market/ui/Panel";
import { DemoBadge } from "@/components/market/ui/DemoBadge";
import { SkeletonRows } from "@/components/market/ui/Skeleton";
import { LineChart } from "@/components/market/charts/LineChart";
import { fmtNumber } from "@/lib/market/format";

/** Titled single-series macro chart (QCB rate, inflation, GDP, ...). */
export function MacroChartCard({
  seriesId,
  height = 200,
  decimals = 2,
}: {
  seriesId: string;
  height?: number;
  decimals?: number;
}) {
  const { data, loading } = useAsync(() => marketApi.macro(seriesId), [seriesId]);
  const s = data?.series;
  const latest = s?.dataPoints.at(-1);
  const prev = s?.dataPoints.at(-2);
  const delta = latest && prev ? latest.value - prev.value : 0;

  return (
    <Panel
      title={s?.name ?? seriesId}
      subtitle={s ? `${s.source} · ${s.frequency}` : undefined}
      actions={<DemoBadge isMock={data?.isMock ?? true} />}
    >
      {loading && !s ? (
        <SkeletonRows rows={4} />
      ) : s ? (
        <>
          <div className="mb-1 flex items-baseline gap-2">
            <span className="num text-xl font-bold text-terminal-bright">
              {fmtNumber(latest?.value ?? 0, decimals)}
              <span className="ml-1 text-xs font-normal text-terminal-muted">{s.unit}</span>
            </span>
            <span
              className={`num text-[11px] ${delta >= 0 ? "text-terminal-up" : "text-terminal-down"}`}
            >
              {delta >= 0 ? "+" : ""}
              {fmtNumber(delta, decimals)} vs prev
            </span>
          </div>
          <LineChart
            series={[{ label: s.name, points: s.dataPoints }]}
            height={height}
            unit={s.unit}
            valueDecimals={decimals}
          />
        </>
      ) : null}
    </Panel>
  );
}
