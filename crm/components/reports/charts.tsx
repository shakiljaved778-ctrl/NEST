"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Funnel,
  FunnelChart,
  LabelList,
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

export function FunnelChartCard({ data }: { data: { name: string; value: number; fill: string }[] }) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <FunnelChart>
        <Tooltip content={<ChartTooltip />} />
        <Funnel dataKey="value" data={data} isAnimationActive>
          <LabelList position="right" fill="hsl(var(--foreground))" stroke="none" dataKey="name" fontSize={12} />
          <LabelList position="left" fill="hsl(var(--muted-foreground))" stroke="none" dataKey="value" fontSize={12} />
        </Funnel>
      </FunnelChart>
    </ResponsiveContainer>
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
