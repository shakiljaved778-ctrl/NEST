"use client";
import { marketApi } from "@/lib/market/api";
import { useAsync } from "@/lib/market/useAsync";
import { Panel } from "@/components/market/ui/Panel";
import { DemoBadge } from "@/components/market/ui/DemoBadge";
import { ChangePill } from "@/components/market/ui/ChangePill";
import { SkeletonRows } from "@/components/market/ui/Skeleton";
import { LineChart, type LineSeries } from "@/components/market/charts/LineChart";
import { SERIES_COLORS } from "@/components/market/charts/chartUtils";
import { fmtNumber } from "@/lib/market/format";

/** GCC indices — normalized YTD performance (base 100) + snapshot table. */
export function GccComparison() {
  const { data, loading } = useAsync(() => marketApi.gcc(), []);

  const series: LineSeries[] =
    data?.indices.map((idx, i) => ({
      label: idx.symbol,
      color: SERIES_COLORS[i % SERIES_COLORS.length],
      points: idx.ytd.map((p) => ({ timestamp: p.timestamp, value: p.value })),
    })) ?? [];

  return (
    <Panel
      title="GCC Indices — YTD (normalized to 100)"
      actions={<DemoBadge isMock={data?.isMock ?? true} />}
    >
      {loading && !data ? (
        <SkeletonRows rows={5} />
      ) : (
        <>
          <LineChart series={series} area={false} height={220} valueDecimals={0} />
          <table className="mt-3 w-full text-xs">
            <tbody>
              {data?.indices.map((idx) => (
                <tr key={idx.symbol} className="border-t border-terminal-border/60">
                  <td className="px-1 py-1.5">
                    <span className="font-bold text-terminal-bright">{idx.symbol}</span>
                    <span className="ml-2 text-[10px] text-terminal-muted">
                      {idx.country}
                    </span>
                  </td>
                  <td className="num px-1 py-1.5 text-right text-terminal-text">
                    {fmtNumber(idx.quote.price, 0)}
                  </td>
                  <td className="px-1 py-1.5 text-right">
                    <ChangePill changePercent={idx.quote.changePercent} size="xs" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </Panel>
  );
}
