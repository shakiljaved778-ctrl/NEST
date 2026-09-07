"use client";
import { CHART, extent, linearScale, ticks, useElementWidth } from "./chartUtils";
import { fmtNumber } from "@/lib/market/format";

export interface ScatterPoint {
  x: number;
  y: number;
}

/** Scatter with a least-squares trend line (e.g. oil vs QE index). */
export function ScatterChart({
  points,
  height = 240,
  xLabel = "",
  yLabel = "",
}: {
  points: ScatterPoint[];
  height?: number;
  xLabel?: string;
  yLabel?: string;
}) {
  const [ref, width] = useElementWidth<HTMLDivElement>();
  const padL = 48;
  const padR = 12;
  const padT = 12;
  const padB = 34;
  const plotW = Math.max(10, width - padL - padR);
  const plotH = height - padT - padB;

  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  const [xMin, xMax] = extent(xs);
  const [yMin, yMax] = extent(ys);
  const sx = linearScale(xMin, xMax, padL, padL + plotW);
  const sy = linearScale(yMin, yMax, padT + plotH, padT);

  // Least-squares fit + Pearson r.
  const n = points.length || 1;
  const mx = xs.reduce((a, b) => a + b, 0) / n;
  const my = ys.reduce((a, b) => a + b, 0) / n;
  let sxy = 0;
  let sxx = 0;
  let syy = 0;
  for (const p of points) {
    sxy += (p.x - mx) * (p.y - my);
    sxx += (p.x - mx) ** 2;
    syy += (p.y - my) ** 2;
  }
  const slope = sxx ? sxy / sxx : 0;
  const intercept = my - slope * mx;
  const r = sxx && syy ? sxy / Math.sqrt(sxx * syy) : 0;

  return (
    <div ref={ref} className="w-full">
      <svg width={width} height={height}>
        {ticks(yMin, yMax, 4).map((t) => (
          <g key={`y${t}`}>
            <line x1={padL} x2={padL + plotW} y1={sy(t)} y2={sy(t)} stroke={CHART.grid} />
            <text x={padL - 6} y={sy(t) + 3} textAnchor="end" fontSize={10} fill={CHART.axis} className="font-mono">
              {fmtNumber(t, 0)}
            </text>
          </g>
        ))}
        {ticks(xMin, xMax, 4).map((t) => (
          <text key={`x${t}`} x={sx(t)} y={height - padB + 14} textAnchor="middle" fontSize={10} fill={CHART.axis} className="font-mono">
            {fmtNumber(t, 0)}
          </text>
        ))}

        {points.map((p, i) => (
          <circle key={i} cx={sx(p.x)} cy={sy(p.y)} r={2.6} fill={CHART.accent} opacity={0.55} />
        ))}

        <line
          x1={sx(xMin)}
          y1={sy(slope * xMin + intercept)}
          x2={sx(xMax)}
          y2={sy(slope * xMax + intercept)}
          stroke={CHART.up}
          strokeWidth={1.6}
          strokeDasharray="4 3"
        />

        <text x={padL} y={height - 4} fontSize={10} fill={CHART.axis}>
          {xLabel}
        </text>
        <text x={12} y={padT + 4} fontSize={10} fill={CHART.axis} transform={`rotate(-90 12 ${padT + 4})`}>
          {yLabel}
        </text>
      </svg>
      <div className="px-1 text-[11px] text-terminal-muted">
        Correlation (r):{" "}
        <span className={`num font-semibold ${r >= 0 ? "text-terminal-up" : "text-terminal-down"}`}>
          {fmtNumber(r, 2)}
        </span>
      </div>
    </div>
  );
}
