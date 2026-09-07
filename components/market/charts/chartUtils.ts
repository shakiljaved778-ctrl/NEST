"use client";
/**
 * Shared helpers for the SVG chart primitives.
 *
 * The charts are intentionally dependency-free (no TradingView/Highcharts/
 * Recharts) so the demo builds and renders anywhere. Each chart is a small,
 * self-contained component behind a stable prop contract — swap in a heavier
 * library later without changing callers.
 */
import { useEffect, useRef, useState } from "react";

/** Measure a container's pixel width so SVGs render crisp (no viewBox scaling). */
export function useElementWidth<T extends HTMLElement>(): [
  React.RefObject<T | null>,
  number,
] {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(600);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => setWidth(el.clientWidth || 600);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, width];
}

export interface Scale {
  (v: number): number;
}

/** Linear scale from data domain → pixel range. */
export function linearScale(
  domainMin: number,
  domainMax: number,
  rangeMin: number,
  rangeMax: number,
): Scale {
  const d = domainMax - domainMin || 1;
  const r = rangeMax - rangeMin;
  return (v: number) => rangeMin + ((v - domainMin) / d) * r;
}

/** Build an SVG path "d" from points. */
export function linePath(points: { x: number; y: number }[]): string {
  if (points.length === 0) return "";
  return points
    .map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(2)},${p.y.toFixed(2)}`)
    .join(" ");
}

export function extent(values: number[]): [number, number] {
  let min = Infinity;
  let max = -Infinity;
  for (const v of values) {
    if (v < min) min = v;
    if (v > max) max = v;
  }
  if (!Number.isFinite(min)) return [0, 1];
  if (min === max) return [min - 1, max + 1];
  return [min, max];
}

/** Simple moving average (returns array aligned to input, leading nulls). */
export function sma(values: number[], period: number): (number | null)[] {
  const out: (number | null)[] = [];
  let sum = 0;
  for (let i = 0; i < values.length; i++) {
    sum += values[i];
    if (i >= period) sum -= values[i - period];
    out.push(i >= period - 1 ? sum / period : null);
  }
  return out;
}

/** Nice, human-friendly tick values across a range. */
export function ticks(min: number, max: number, count = 4): number[] {
  const span = max - min || 1;
  const step = niceStep(span / count);
  const start = Math.ceil(min / step) * step;
  const out: number[] = [];
  for (let v = start; v <= max + 1e-9; v += step) out.push(round(v));
  return out;
}

function niceStep(raw: number): number {
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const norm = raw / mag;
  const nice = norm < 1.5 ? 1 : norm < 3 ? 2 : norm < 7 ? 5 : 10;
  return nice * mag;
}

function round(v: number): number {
  return Math.round(v * 1000) / 1000;
}

export const CHART = {
  up: "#16c784",
  down: "#ea3943",
  grid: "#232c40",
  axis: "#7b8aa8",
  accent: "#3b82f6",
  volume: "#2d3750",
} as const;

/** Categorical palette for multi-series / allocations. */
export const SERIES_COLORS = [
  "#3b82f6",
  "#16c784",
  "#f0b90b",
  "#8b5cf6",
  "#ea3943",
  "#22d3ee",
  "#f97316",
  "#ec4899",
];
