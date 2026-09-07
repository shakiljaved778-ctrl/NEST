"use client";
import { SERIES_COLORS } from "./chartUtils";
import { fmtNumber } from "@/lib/market/format";

export interface DonutSlice {
  label: string;
  value: number;
}

/** Allocation donut with a centered total and a legend. */
export function DonutChart({
  slices,
  size = 180,
  centerLabel,
  centerValue,
}: {
  slices: DonutSlice[];
  size?: number;
  centerLabel?: string;
  centerValue?: string;
}) {
  const total = slices.reduce((s, x) => s + x.value, 0) || 1;
  const r = size / 2;
  const stroke = size * 0.16;
  const radius = r - stroke / 2 - 2;
  const circ = 2 * Math.PI * radius;
  let offset = 0;

  return (
    <div className="flex items-center gap-4">
      <svg width={size} height={size} className="shrink-0">
        <g transform={`rotate(-90 ${r} ${r})`}>
          {slices.map((s, i) => {
            const frac = s.value / total;
            const len = frac * circ;
            const el = (
              <circle
                key={s.label}
                cx={r}
                cy={r}
                r={radius}
                fill="none"
                stroke={SERIES_COLORS[i % SERIES_COLORS.length]}
                strokeWidth={stroke}
                strokeDasharray={`${len} ${circ - len}`}
                strokeDashoffset={-offset}
              />
            );
            offset += len;
            return el;
          })}
        </g>
        {(centerValue || centerLabel) && (
          <text x={r} y={r} textAnchor="middle" className="font-mono">
            {centerValue && (
              <tspan x={r} dy="-2" fontSize={size * 0.11} fill="#eef2fb" fontWeight={700}>
                {centerValue}
              </tspan>
            )}
            {centerLabel && (
              <tspan x={r} dy="16" fontSize={size * 0.065} fill="#7b8aa8">
                {centerLabel}
              </tspan>
            )}
          </text>
        )}
      </svg>
      <ul className="min-w-0 flex-1 space-y-1 text-[11px]">
        {slices.map((s, i) => (
          <li key={s.label} className="flex items-center gap-2">
            <span
              className="inline-block h-2.5 w-2.5 shrink-0 rounded-sm"
              style={{ background: SERIES_COLORS[i % SERIES_COLORS.length] }}
            />
            <span className="min-w-0 flex-1 truncate text-terminal-text">{s.label}</span>
            <span className="num text-terminal-muted">
              {fmtNumber((s.value / total) * 100, 1)}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
