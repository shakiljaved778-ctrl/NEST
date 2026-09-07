"use client";
import { extent, linearScale, linePath } from "./chartUtils";

/** Tiny inline trend line (used in tickers, tiles, table rows). */
export function Sparkline({
  values,
  width = 88,
  height = 28,
  up,
}: {
  values: number[];
  width?: number;
  height?: number;
  /** Force color direction; defaults to last-vs-first. */
  up?: boolean;
}) {
  if (values.length < 2) return <svg width={width} height={height} />;
  const [min, max] = extent(values);
  const x = linearScale(0, values.length - 1, 1, width - 1);
  const y = linearScale(min, max, height - 2, 2);
  const pts = values.map((v, i) => ({ x: x(i), y: y(v) }));
  const rising = up ?? values[values.length - 1] >= values[0];
  const color = rising ? "#16c784" : "#ea3943";
  const areaId = `spark-${Math.random().toString(36).slice(2, 8)}`;
  return (
    <svg width={width} height={height} className="overflow-visible">
      <defs>
        <linearGradient id={areaId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity={0.25} />
          <stop offset="100%" stopColor={color} stopOpacity={0} />
        </linearGradient>
      </defs>
      <path
        d={`${linePath(pts)} L${(width - 1).toFixed(2)},${height} L1,${height} Z`}
        fill={`url(#${areaId})`}
      />
      <path d={linePath(pts)} fill="none" stroke={color} strokeWidth={1.5} />
    </svg>
  );
}
