"use client";

import {
  ArcElement,
  BarController,
  BarElement,
  CategoryScale,
  Chart,
  type ChartConfiguration,
  DoughnutController,
  Legend,
  LinearScale,
  LineController,
  LineElement,
  PointElement,
  Tooltip,
} from "chart.js";
import { useEffect, useRef } from "react";

Chart.register(
  ArcElement,
  BarController,
  BarElement,
  CategoryScale,
  DoughnutController,
  Legend,
  LinearScale,
  LineController,
  LineElement,
  PointElement,
  Tooltip,
);

const SEVERITY_COLOURS = { info: "#64748b", caution: "#d97706", critical: "#b42318" };

function useChart(config: () => ChartConfiguration) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (!ref.current) return;
    const chart = new Chart(ref.current, config());
    return () => chart.destroy();
    // The config is rebuilt from props on every render: recreate the chart when its data changes.
  }, [JSON.stringify(config().data)]);
  return ref;
}

export function SeverityByPackChart({
  rows,
}: {
  rows: { label: string; info: number; caution: number; critical: number }[];
}) {
  const ref = useChart(() => ({
    type: "bar",
    data: {
      labels: rows.map((r) => r.label),
      datasets: (["critical", "caution", "info"] as const).map((s) => ({
        label: s[0]?.toUpperCase() + s.slice(1),
        data: rows.map((r) => r[s]),
        backgroundColor: SEVERITY_COLOURS[s],
        stack: "s",
      })),
    },
    options: {
      indexAxis: "y",
      maintainAspectRatio: false,
      animation: false,
      scales: { x: { stacked: true, ticks: { precision: 0 } }, y: { stacked: true } },
      plugins: { legend: { position: "bottom" } },
    },
  }));
  return (
    <div style={{ height: Math.max(180, rows.length * 34 + 60) }}>
      <canvas ref={ref} aria-label="Insights shown by pack and severity" role="img" />
    </div>
  );
}

export function DailyChart({ rows }: { rows: { day: string; count: number }[] }) {
  const ref = useChart(() => ({
    type: "line",
    data: {
      labels: rows.map((r) => r.day.slice(5)),
      datasets: [
        {
          label: "Insights shown",
          data: rows.map((r) => r.count),
          borderColor: "#7a1f3d",
          backgroundColor: "#7a1f3d",
          tension: 0.25,
          pointRadius: 2,
        },
      ],
    },
    options: {
      maintainAspectRatio: false,
      animation: false,
      scales: { y: { beginAtZero: true, ticks: { precision: 0 } } },
      plugins: { legend: { display: false } },
    },
  }));
  return (
    <div style={{ height: 220 }}>
      <canvas ref={ref} aria-label="Insights shown per day" role="img" />
    </div>
  );
}

export function ResponsesChart({ rows }: { rows: { label: string; count: number }[] }) {
  const ref = useChart(() => ({
    type: "doughnut",
    data: {
      labels: rows.map((r) => r.label),
      datasets: [
        {
          data: rows.map((r) => r.count),
          backgroundColor: ["#94a3b8", "#7a1f3d", "#c9a227", "#d4d4d8"],
        },
      ],
    },
    options: {
      maintainAspectRatio: false,
      animation: false,
      plugins: { legend: { position: "bottom" } },
    },
  }));
  return (
    <div style={{ height: 220 }}>
      <canvas ref={ref} aria-label="Customer responses" role="img" />
    </div>
  );
}
