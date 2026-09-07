"use client";
import { fmtSignedPct, fmtSigned } from "@/lib/market/format";

/** Colored signed-change badge (▲/▼ + value). */
export function ChangePill({
  change,
  changePercent,
  showAbs = false,
  size = "sm",
}: {
  change?: number;
  changePercent: number;
  showAbs?: boolean;
  size?: "xs" | "sm" | "md";
}) {
  const up = changePercent > 0;
  const flat = changePercent === 0;
  const color = flat
    ? "text-terminal-muted"
    : up
      ? "text-terminal-up"
      : "text-terminal-down";
  const arrow = flat ? "▬" : up ? "▲" : "▼";
  const cls =
    size === "xs" ? "text-[10px]" : size === "md" ? "text-sm" : "text-xs";
  return (
    <span className={`num inline-flex items-center gap-1 font-semibold ${color} ${cls}`}>
      <span className="text-[0.7em]">{arrow}</span>
      {showAbs && change !== undefined && <span>{fmtSigned(change)}</span>}
      <span>{fmtSignedPct(changePercent)}</span>
    </span>
  );
}
