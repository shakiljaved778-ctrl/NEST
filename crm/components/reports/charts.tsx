"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { fmtMoney, fmtNumber } from "@/lib/utils";

// One coherent categorical palette (teal-anchored to match the brand primary),
// accessible in both light and dark.
export const PALETTE = ["#0f766e", "#0891b2", "#7c3aed", "#d97706", "#dc2626", "#65a30d", "#db2777", "#475569"];

const axisStyle = { fontSize: 12, fill: "hsl(var(--muted-foreground))" } as const;

function ChartTooltip({ active, payload, label, money }: { active?: boolean; payload?: { name: string; value: number; color?: string }[]; label?: string; money?: boolean }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-md border bg-background p-2 text-xs shadow-md">
      {label && <p className="mb-1 font-medium">{label}</p>}
      {payload.map((p, i) => (
        <p key={i} className="flex items-center gap-1.5">
          {p.color && <span className="inline-block h-2 w-2 rounded-full" style={{ background: p.color }} />}
          {p.name}: <span className="font-medium">{money ? fmtMoney(p.value) : fmtNumber(p.value)}</span>
        </p>
      ))}
    </div>
  );
}

// A CSS funnel of tapering, centered bars. Recharts' <Funnel> ignores per-slice
// fill in this version, and stacked bars read more clearly anyway: each stage is
// a bar whose width is proportional to its count, with the step-to-step
// conversion rate shown between stages.
export function FunnelChartCard({ data }: { data: { name: string; value: number; fill?: string }[] }) {
  const max = Math.max(...data.map((d) => d.value), 1);
  // Color by index from the shared palette (kept here so it never depends on a
  // fill prop crossing the server/client-component boundary).
  const colors = [PALETTE[0], PALETTE[1], PALETTE[2], PALETTE[3], PALETTE[5]];
  return (
    <div className="space-y-2 py-2">
      {data.map((d, i) => {
        const pct = Math.max((d.value / max) * 100, 6);
        const prev = i > 0 ? data[i - 1].value : null;
        const step = prev && prev > 0 ? Math.round((d.value / prev) * 100) : null;
        return (
          <div key={d.name} className="flex items-center gap-3">
            <span className="w-24 shrink-0 text-sm text-muted-foreground">{d.name}</span>
            <div className="flex flex-1 items-center gap-2">
              <div
                className="flex h-8 items-center justify-end rounded-md px-2 text-xs font-semibold text-white transition-all"
                style={{ width: `${pct}%`, backgroundColor: d.fill ?? colors[i % colors.length] }}
              >
                {d.value}
              </div>
              {step !== null && <span className="shrink-0 text-xs text-muted-foreground">{step}%</span>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function PipelineBarChart({ data }: { data: { stage: string; value: number; weighted: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={data} margin={{ left: 10, right: 10 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
        <XAxis dataKey="stage" tick={axisStyle} tickLine={false} axisLine={false} />
        <YAxis tick={axisStyle} tickLine={false} axisLine={false} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} width={40} />
        <Tooltip content={<ChartTooltip money />} cursor={{ fill: "hsl(var(--muted))" }} />
        <Bar dataKey="value" name="Pipeline" radius={[4, 4, 0, 0]} fill={PALETTE[0]} />
        <Bar dataKey="weighted" name="Weighted" radius={[4, 4, 0, 0]} fill={PALETTE[1]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function SourcePieChart({ data }: { data: { source: string; total: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <PieChart>
        <Pie data={data} dataKey="total" nameKey="source" cx="50%" cy="50%" outerRadius={90} innerRadius={45}>
          {data.map((_, i) => (
            <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
          ))}
        </Pie>
        <Tooltip content={<ChartTooltip />} />
      </PieChart>
    </ResponsiveContainer>
  );
}

export function HBarChart({ data, money }: { data: { label: string; value: number }[]; money?: boolean }) {
  return (
    <ResponsiveContainer width="100%" height={Math.max(data.length * 34, 120)}>
      <BarChart data={data} layout="vertical" margin={{ left: 10, right: 20 }}>
        <XAxis type="number" tick={axisStyle} tickLine={false} axisLine={false} tickFormatter={money ? (v) => `${(v / 1000).toFixed(0)}k` : undefined} />
        <YAxis type="category" dataKey="label" tick={axisStyle} tickLine={false} axisLine={false} width={140} />
        <Tooltip content={<ChartTooltip money={money} />} cursor={{ fill: "hsl(var(--muted))" }} />
        <Bar dataKey="value" radius={[0, 4, 4, 0]} fill={PALETTE[0]}>
          {data.map((_, i) => (
            <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
