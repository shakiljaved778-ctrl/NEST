"use client";
import { useState } from "react";
import type { Bar } from "@/types/market";
import {
  CHART,
  extent,
  linearScale,
  linePath,
  sma,
  ticks,
  useElementWidth,
} from "./chartUtils";
import { fmtNumber, fmtCompact, fmtDateShort, fmtTime } from "@/lib/market/format";

/**
 * Candlestick chart with a volume sub-panel and optional SMA overlays.
 * `maxIndicators` caps how many overlays render (freemium gating).
 */
export function CandleChart({
  bars,
  height = 320,
  intraday = false,
  smaPeriods = [],
  maxIndicators = 6,
}: {
  bars: Bar[];
  height?: number;
  intraday?: boolean;
  smaPeriods?: number[];
  maxIndicators?: number;
}) {
  const [ref, width] = useElementWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);

  if (bars.length === 0) {
    return <div ref={ref} className="w-full" style={{ height }} />;
  }

  const padL = 52;
  const padR = 10;
  const padT = 8;
  const volH = 54;
  const gap = 8;
  const padB = 20;
  const plotW = Math.max(10, width - padL - padR);
  const priceH = height - padT - volH - gap - padB;

  const lows = bars.map((b) => b.low);
  const highs = bars.map((b) => b.high);
  const [yMin, yMax] = extent([...lows, ...highs]);
  const [, volMax] = extent(bars.map((b) => b.volume));

  const n = bars.length;
  const bw = plotW / n;
  const x = (i: number) => padL + i * bw + bw / 2;
  const y = linearScale(yMin, yMax, padT + priceH, padT);
  const volY = linearScale(0, volMax, height - padB, height - padB - volH);
  const yTicks = ticks(yMin, yMax, 4);

  const closes = bars.map((b) => b.close);
  const activeSma = smaPeriods.slice(0, Math.max(0, maxIndicators));
  const smaColors = ["#f0b90b", "#8b5cf6", "#22d3ee"];

  const hoverIdx =
    hover !== null
      ? Math.min(n - 1, Math.max(0, Math.floor((hover - padL) / bw)))
      : null;
  const hb = hoverIdx !== null ? bars[hoverIdx] : null;

  const candleW = Math.max(1, Math.min(10, bw * 0.62));

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
        {yTicks.map((t) => (
          <g key={t}>
            <line x1={padL} x2={padL + plotW} y1={y(t)} y2={y(t)} stroke={CHART.grid} />
            <text
              x={padL - 6}
              y={y(t) + 3}
              textAnchor="end"
              fontSize={10}
              fill={CHART.axis}
              className="font-mono"
            >
              {fmtNumber(t, t >= 1000 ? 0 : 2)}
            </text>
          </g>
        ))}

        {/* candles */}
        {bars.map((b, i) => {
          const upBar = b.close >= b.open;
          const color = upBar ? CHART.up : CHART.down;
          const oY = y(b.open);
          const cY = y(b.close);
          const bodyTop = Math.min(oY, cY);
          const bodyH = Math.max(1, Math.abs(cY - oY));
          return (
            <g key={i}>
              <line x1={x(i)} x2={x(i)} y1={y(b.high)} y2={y(b.low)} stroke={color} strokeWidth={1} />
              <rect
                x={x(i) - candleW / 2}
                y={bodyTop}
                width={candleW}
                height={bodyH}
                fill={color}
              />
              <rect
                x={x(i) - Math.max(candleW / 2, bw / 2)}
                y={height - padB - volH}
                width={Math.max(candleW, bw * 0.9)}
                height={Math.max(0, height - padB - volY(b.volume))}
                fill={upBar ? "rgba(22,199,132,0.35)" : "rgba(234,57,67,0.35)"}
              />
            </g>
          );
        })}

        {/* SMA overlays */}
        {activeSma.map((p, si) => {
          const vals = sma(closes, p);
          const pts = vals
            .map((v, i) => (v === null ? null : { x: x(i), y: y(v) }))
            .filter((v): v is { x: number; y: number } => v !== null);
          return (
            <path
              key={p}
              d={linePath(pts)}
              fill="none"
              stroke={smaColors[si % smaColors.length]}
              strokeWidth={1.3}
              opacity={0.9}
            />
          );
        })}

        {/* crosshair */}
        {hoverIdx !== null && (
          <line
            x1={x(hoverIdx)}
            x2={x(hoverIdx)}
            y1={padT}
            y2={height - padB}
            stroke={CHART.axis}
            strokeDasharray="3 3"
          />
        )}
      </svg>

      <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 px-1 text-[11px]">
        {activeSma.map((p, si) => (
          <span key={p} className="inline-flex items-center gap-1.5">
            <span
              className="inline-block h-2 w-2 rounded-full"
              style={{ background: smaColors[si % smaColors.length] }}
            />
            <span className="text-terminal-muted">SMA {p}</span>
          </span>
        ))}
        {hb && (
          <span className="num ml-auto flex flex-wrap gap-x-3 text-terminal-muted">
            <span>{intraday ? fmtTime(hb.timestamp) : fmtDateShort(hb.timestamp)}</span>
            <span>O {fmtNumber(hb.open, 2)}</span>
            <span>H {fmtNumber(hb.high, 2)}</span>
            <span>L {fmtNumber(hb.low, 2)}</span>
            <span className="text-terminal-bright">C {fmtNumber(hb.close, 2)}</span>
            <span>V {fmtCompact(hb.volume)}</span>
          </span>
        )}
      </div>
    </div>
  );
}
