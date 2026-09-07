/** Formatting helpers shared across the dashboard (compact, terminal-style). */

export function fmtNumber(v: number, decimals = 2): string {
  return v.toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

/** Adaptive decimals: FX/penny stocks get more precision. */
export function fmtPrice(v: number): string {
  const d = Math.abs(v) >= 100 ? 2 : Math.abs(v) >= 1 ? 2 : 3;
  return fmtNumber(v, d);
}

export function fmtSignedPct(v: number): string {
  const s = v > 0 ? "+" : "";
  return `${s}${fmtNumber(v, 2)}%`;
}

export function fmtSigned(v: number, decimals = 2): string {
  const s = v > 0 ? "+" : "";
  return `${s}${fmtNumber(v, decimals)}`;
}

/** Compact magnitude: 1.2M, 3.4B, 890K. */
export function fmtCompact(v: number): string {
  const abs = Math.abs(v);
  if (abs >= 1e9) return `${fmtNumber(v / 1e9, 2)}B`;
  if (abs >= 1e6) return `${fmtNumber(v / 1e6, 2)}M`;
  if (abs >= 1e3) return `${fmtNumber(v / 1e3, 1)}K`;
  return fmtNumber(v, 0);
}

export function fmtQar(v: number, decimals = 2): string {
  return `QAR ${fmtNumber(v, decimals)}`;
}

export function fmtMarketCap(v: number): string {
  return `QAR ${fmtCompact(v)}`;
}

export function fmtTime(ts: number): string {
  return new Date(ts).toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function fmtDate(ts: number): string {
  return new Date(ts).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function fmtDateShort(ts: number): string {
  return new Date(ts).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
  });
}

/** Tailwind text color for a signed value. */
export function changeColor(v: number): string {
  if (v > 0) return "text-terminal-up";
  if (v < 0) return "text-terminal-down";
  return "text-terminal-muted";
}
