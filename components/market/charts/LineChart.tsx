"use client";
import { useState } from "react";
import {
  CHART,
  SERIES_COLORS,
  extent,
  linearScale,
  linePath,
  ticks,
  useElementWidth,
} from "./chartUtils";
import { fmtDateShort, fmtNumber } from "@/lib/market/format";

export interface LineSeries {
  label: string;
  color?: string;
  points: { timestamp: number; value: number }[];
}

/**
 * Multi-series line / area chart with a hover crosshair. Handles a single
 * series (area fill) or several (comparison, no fill). Time axis on X.
 */
export function LineChart({
  series,
  height = 240,
  area = true,
  unit = "",
  valueDecimals = 2,
}: {
  series: LineSeries[];
  height?: number;
  area?: boolean;
  unit?: string;
  valueDecimals?: number;
}) {
  const [ref, width] = useElementWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);

  const padL = 48;
  const padR = 12;
  const padT = 10;
  const padB = 22;
  const plotW = Math.max(10, width - padL - padR);
  const plotH = height - padT - padB;

  const all = series.flatMap((s) => s.points.map((p) => p.value));
  const times = series[0]?.points.map((p) => p.timestamp) ?? [];
  const [yMin, yMax] = extent(all);
  const n = series[0]?.points.length ?? 0;

  const x = linearScale(0, Math.max(1, n - 1), padL, padL + plotW);
  const y = linearScale(yMin, yMax, padT + plotH, padT);
  const yTicks = ticks(yMin, yMax, 4);

  const hoverIdx =
    hover !== null && n > 0
      ? Math.min(n - 1, Math.max(0, Math.round(((hover - padL) / plotW) * (n - 1))))
      : null;

  return (
    <div ref={ref} className="w-full">
      <svg
        width={width}
        height={height}
        onMouseMove={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          setHover(e.clientX - rect.left);
        }}
        onMouseLeave={() => setHover(null)}
      >
        {/* grid + y labels */}
        {yTicks.map((t) => (
          <g key={t}>
            <line
              x1={padL}
              x2={padL + plotW}
              y1={y(t)}
              y2={y(t)}
              stroke={CHART.grid}
              strokeWidth={1}
            />
            <text
              x={padL - 6}
              y={y(t) + 3}
              textAnchor="end"
              fontSize={10}
              fill={CHART.axis}
              className="font-mono"
            >
              {fmtNumber(t, valueDecimals)}
            </text>
          </g>
        ))}

        {/* x labels (first / mid / last) */}
        {n > 1 &&
          [0, Math.floor(n / 2), n - 1].map((i) => (
            <text
              key={i}
              x={x(i)}
              y={height - 6}
              textAnchor={i === 0 ? "start" : i === n - 1 ? "end" : "middle"}
              fontSize={10}
              fill={CHART.axis}
              className="font-mono"
            >
              {fmtDateShort(times[i])}
            </text>
          ))}

        {/* series */}
        {series.map((s, si) => {
          const color = s.color ?? SERIES_COLORS[si % SERIES_COLORS.length];
          const pts = s.points.map((p, i) => ({ x: x(i), y: y(p.value) }));
          const gid = `line-fill-${si}`;
          return (
            <g key={s.label}>
              {area && series.length === 1 && (
                <>
                  <defs>
                    <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={color} stopOpacity={0.28} />
                      <stop offset="100%" stopColor={color} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <path
                    d={`${linePath(pts)} L${x(n - 1)},${padT + plotH} L${x(0)},${padT + plotH} Z`}
                    fill={`url(#${gid})`}
                  />
                </>
              )}
              <path d={linePath(pts)} fill="none" stroke={color} strokeWidth={1.6} />
            </g>
          );
        })}

        {/* crosshair */}
        {hoverIdx !== null && (
          <line
            x1={x(hoverIdx)}
            x2={x(hoverIdx)}
            y1={padT}
            y2={padT + plotH}
            stroke={CHART.axis}
            strokeDasharray="3 3"
            strokeWidth={1}
          />
        )}
        {hoverIdx !== null &&
          series.map((s, si) => {
            const p = s.points[hoverIdx];
            if (!p) return null;
            const color = s.color ?? SERIES_COLORS[si % SERIES_COLORS.length];
            return (
              <circle key={s.label} cx={x(hoverIdx)} cy={y(p.value)} r={3} fill={color} />
            );
          })}
      </svg>

      {/* legend + hover readout */}
      <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 px-1 text-[11px]">
        {series.map((s, si) => {
          const color = s.color ?? SERIES_COLORS[si % SERIES_COLORS.length];
          const hv = hoverIdx !== null ? s.points[hoverIdx]?.value : undefined;
          return (
            <span key={s.label} className="inline-flex items-center gap-1.5">
              <span
                className="inline-block h-2 w-2 rounded-full"
                style={{ background: color }}
              />
              <span className="text-terminal-muted">{s.label}</span>
              {hv !== undefined && (
                <span className="num text-terminal-bright">
                  {fmtNumber(hv, valueDecimals)}
                  {unit}
                </span>
              )}
            </span>
          );
        })}
        {hoverIdx !== null && times[hoverIdx] && (
          <span className="num ml-auto text-terminal-muted">
            {fmtDateShort(times[hoverIdx])}
          </span>
        )}
      </div>
    </div>
  );
}
