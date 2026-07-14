"use client";

import { useState } from "react";

export interface TrendPoint {
  date: string;
  value: number;
}

/**
 * Single-series SVG line chart: thin 2px line, recessive grid, direct label
 * on the latest point, per-point hover tooltip. No legend — the card title
 * names the series.
 */
export default function TrendChart({
  points,
  color,
  unit,
  height = 120,
}: {
  points: TrendPoint[];
  color: string;
  unit: string;
  height?: number;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const width = 560;
  const pad = { top: 14, right: 56, bottom: 22, left: 10 };

  if (points.length === 0) {
    return (
      <div className="flex h-[120px] items-center justify-center text-sm text-inkSoft/60">
        No data yet — log a check-in to start the trend.
      </div>
    );
  }

  const values = points.map((p) => p.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const innerW = width - pad.left - pad.right;
  const innerH = height - pad.top - pad.bottom;

  const x = (i: number) =>
    pad.left + (points.length === 1 ? innerW / 2 : (i / (points.length - 1)) * innerW);
  const y = (v: number) => pad.top + innerH - ((v - min) / span) * innerH;

  const path = points
    .map((p, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(p.value).toFixed(1)}`)
    .join(" ");

  const last = points[points.length - 1];
  const gridYs = [pad.top, pad.top + innerH / 2, pad.top + innerH];

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="w-full"
      role="img"
      aria-label={`Trend, latest ${last.value}${unit}`}
    >
      {gridYs.map((gy) => (
        <line key={gy} x1={pad.left} x2={width - pad.right} y1={gy} y2={gy} stroke="#E4EAF2" strokeWidth={1} />
      ))}
      <path d={path} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
      {points.map((p, i) => (
        <g key={p.date}>
          {/* invisible wide hit target */}
          <rect
            x={x(i) - Math.max(innerW / Math.max(points.length - 1, 1) / 2, 8)}
            y={0}
            width={Math.max(innerW / Math.max(points.length - 1, 1), 16)}
            height={height}
            fill="transparent"
            onMouseEnter={() => setHover(i)}
            onMouseLeave={() => setHover(null)}
          />
          {(hover === i || i === points.length - 1) && (
            <circle cx={x(i)} cy={y(p.value)} r={4} fill={color} stroke="#FFFFFF" strokeWidth={2} />
          )}
        </g>
      ))}
      {/* direct label: latest value (or hovered point) */}
      {(() => {
        const i = hover ?? points.length - 1;
        const p = points[i];
        const labelY = Math.max(y(p.value) - 8, 12);
        return (
          <g>
            <text
              x={Math.min(x(i) + 8, width - 4)}
              y={labelY}
              textAnchor={x(i) > width - 90 ? "end" : "start"}
              className="fill-ink"
              fontSize={12}
              fontWeight={600}
            >
              {p.value}
              {unit}
            </text>
            <text
              x={Math.min(x(i) + 8, width - 4)}
              y={height - 6}
              textAnchor={x(i) > width - 90 ? "end" : "start"}
              className="fill-inkSoft"
              fontSize={10}
            >
              {p.date.slice(5)}
            </text>
          </g>
        );
      })()}
    </svg>
  );
}
