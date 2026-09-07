"use client";
import { useEffect } from "react";
import { useAppState } from "@/components/market/providers/AppState";
import { MacroChartCard } from "@/components/market/panels/MacroChartCard";
import { OilIndexCorrelation } from "@/components/market/panels/OilIndexCorrelation";
import { GccComparison } from "@/components/market/panels/GccComparison";
import { LockOverlay } from "@/components/market/ui/UpgradeCTA";

export default function MacroPage() {
  const { features, track } = useAppState();
  useEffect(() => track("view_macro"), [track]);

  return (
    <div className="space-y-3">
      <div>
        <h1 className="text-base font-bold text-terminal-bright">Macro Dashboard</h1>
        <p className="text-xs text-terminal-muted">
          Qatar policy, prices &amp; growth, with GCC and global context. Demo data.
        </p>
      </div>

      {/* Free-tier key indicators */}
      <div className="grid gap-3 lg:grid-cols-3">
        <MacroChartCard seriesId="qcb_policy_rate" />
        <MacroChartCard seriesId="qatar_cpi_yoy" />
        <MacroChartCard seriesId="qatar_gdp_growth" />
      </div>

      {/* Premium macro depth */}
      <div className="grid gap-3 lg:grid-cols-2">
        {features.macroDepth ? (
          <GccComparison />
        ) : (
          <LockOverlay feature="GCC macro depth" message="GCC & global macro depth is a Premium feature.">
            <GccComparison />
          </LockOverlay>
        )}
        {features.macroDepth ? (
          <OilIndexCorrelation />
        ) : (
          <LockOverlay feature="Oil correlation" message="Correlation analytics are a Premium feature.">
            <OilIndexCorrelation />
          </LockOverlay>
        )}
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        {features.macroDepth ? (
          <>
            <MacroChartCard seriesId="qatar_m2" decimals={0} />
            <MacroChartCard seriesId="qatar_credit_growth" />
          </>
        ) : (
          <LockOverlay
            feature="Money supply & credit"
            message="Money supply & credit series are Premium."
          >
            <div className="grid gap-3">
              <MacroChartCard seriesId="qatar_m2" decimals={0} />
            </div>
          </LockOverlay>
        )}
      </div>
    </div>
  );
}
