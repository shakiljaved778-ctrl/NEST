"use client";
import type { ReactNode } from "react";

/** Compact KPI tile: label, value, optional secondary line. */
export function KpiCard({
  label,
  value,
  sub,
  accent,
}: {
  label: ReactNode;
  value: ReactNode;
  sub?: ReactNode;
  accent?: "up" | "down" | "neutral";
}) {
  const valueColor =
    accent === "up"
      ? "text-terminal-up"
      : accent === "down"
        ? "text-terminal-down"
        : "text-terminal-bright";
  return (
    <div className="rounded-md border border-terminal-border bg-terminal-panel2 px-3 py-2">
      <div className="text-[10px] font-semibold uppercase tracking-wide text-terminal-muted">
        {label}
      </div>
      <div className={`num mt-0.5 text-lg font-semibold leading-tight ${valueColor}`}>
        {value}
      </div>
      {sub && <div className="num mt-0.5 text-[11px] text-terminal-muted">{sub}</div>}
    </div>
  );
}
