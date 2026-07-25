"use client";

import type { ForecastPoint } from "@voyara/contracts";

export function ForecastCurve({
  curve,
  verdict,
}: {
  curve: ForecastPoint[];
  verdict: "BUY" | "WAIT";
}) {
  if (curve.length === 0) return null;
  const w = 260;
  const h = 64;
  const pad = 6;
  const vals = curve.map((p) => p.expectedPriceMinor);
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  const span = Math.max(1, max - min);
  const stroke = verdict === "BUY" ? "#C9A227" : "#6B7DA8";

  const pts = curve.map((p, i) => {
    const x = pad + (i / (curve.length - 1)) * (w - pad * 2);
    const y = pad + (1 - (p.expectedPriceMinor - min) / span) * (h - pad * 2);
    return [x, y] as const;
  });
  const path = pts.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const area = `${path} L${pts[pts.length - 1]![0].toFixed(1)},${h - pad} L${pts[0]![0].toFixed(1)},${h - pad} Z`;

  return (
    <svg width={w} height={h} className="overflow-visible" role="img" aria-label="14-day price forecast">
      <defs>
        <linearGradient id={`g-${verdict}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={stroke} stopOpacity="0.28" />
          <stop offset="100%" stopColor={stroke} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#g-${verdict})`} />
      <path d={path} fill="none" stroke={stroke} strokeWidth="2" strokeLinejoin="round" />
      {pts.map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r={i === 0 ? 3 : 1.5} fill={stroke} />
      ))}
    </svg>
  );
}
