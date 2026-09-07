"use client";
import { useAppState } from "@/components/market/providers/AppState";
import { marketApi } from "@/lib/market/api";
import { useAsync } from "@/lib/market/useAsync";
import { Panel } from "@/components/market/ui/Panel";
import { DemoBadge } from "@/components/market/ui/DemoBadge";
import { SkeletonRows } from "@/components/market/ui/Skeleton";
import { ScatterChart } from "@/components/market/charts/ScatterChart";

/** Scatter of daily Brent vs QE index closes (oil ↔ Qatar market linkage). */
export function OilIndexCorrelation() {
  const { plan } = useAppState();
  const brent = useAsync(() => marketApi.bars("BRENT", "1d", plan), [plan]);
  const qe = useAsync(() => marketApi.bars("QSE", "1d", plan), [plan]);

  const points =
    brent.data && qe.data
      ? qe.data.bars
          .slice(-120)
          .map((b, i) => {
            const oil = brent.data!.bars.slice(-120)[i];
            return oil ? { x: oil.close, y: b.close } : null;
          })
          .filter((p): p is { x: number; y: number } => p !== null)
      : [];

  return (
    <Panel
      title="Oil (Brent) vs QE Index"
      subtitle="Daily closes, last ~120 sessions"
      actions={<DemoBadge isMock={brent.data?.isMock ?? true} />}
    >
      {(brent.loading || qe.loading) && points.length === 0 ? (
        <SkeletonRows rows={4} />
      ) : (
        <ScatterChart points={points} xLabel="Brent (USD/bbl)" yLabel="QE Index" />
      )}
    </Panel>
  );
}
