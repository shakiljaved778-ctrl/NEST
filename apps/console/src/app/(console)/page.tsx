import Link from "next/link";
import { DailyChart, ResponsesChart, SeverityByPackChart } from "@/components/charts";
import { PageHeader, Panel, Section } from "@/components/page-header";
import { adminGet, query } from "@/lib/api";
import { fmtDate, packLabel, RESPONSE_LABELS } from "@/lib/labels";
import { requirePermission } from "@/lib/session";
import type { Dashboard } from "@/lib/types";

const RANGES = [7, 30, 90] as const;

function Kpi({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <Panel>
      <p className="text-xs text-ink-muted">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
      {hint ? <p className="mt-1 text-xs text-ink-muted">{hint}</p> : null}
    </Panel>
  );
}

const pct = (v: number | null) => (v === null ? "–" : `${v}%`);
const qar = (v: string) => {
  const [int = "0", frac] = v.split(".");
  return `QAR ${int.replace(/\B(?=(\d{3})+$)/g, ",")}${frac ? `.${frac}` : ""}`;
};

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ days?: string }>;
}) {
  await requirePermission("dashboard:read");
  const { days: daysParam } = await searchParams;
  const days = RANGES.find((d) => String(d) === daysParam) ?? 30;
  const to = new Date();
  const from = new Date(to.getTime() - days * 86_400_000);
  const d = await adminGet<Dashboard>(
    `/dashboard${query({ from: from.toISOString(), to: to.toISOString() })}`,
  );
  const t = d.totals;
  return (
    <>
      <PageHeader
        title="Dashboard"
        description={`What AMIL showed customers between ${fmtDate(d.from)} and ${fmtDate(d.to)}, how they responded, and how the model safeguards performed. Computed from the audit log.`}
        actions={
          <div className="flex gap-1 rounded-md border border-line bg-white p-1 text-sm">
            {RANGES.map((r) => (
              <Link
                key={r}
                href={`/?days=${r}`}
                className={`rounded px-3 py-1 ${r === days ? "bg-brand text-white" : "hover:bg-zinc-100"}`}
              >
                {r} days
              </Link>
            ))}
          </div>
        }
      />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4" data-testid="kpis">
        <Kpi
          label="Insights shown"
          value={String(t.shown)}
          hint={`${t.events} evaluations in total`}
        />
        <Kpi
          label="Reconsidered actions"
          value={String(t.reconsidered)}
          hint={`${pct(t.reconsideredRatePct)} of ${t.answered} answered action insights`}
        />
        <Kpi
          label="Estimated value protected"
          value={qar(t.valueProtectedQar)}
          hint={`${qar(t.valueSurfacedQar)} surfaced in total`}
        />
        <Kpi
          label="Validator rejections"
          value={pct(t.validatorRejectionRatePct)}
          hint={`Check latency p50 ${t.latencyP50Ms ?? "–"} ms · p95 ${t.latencyP95Ms ?? "–"} ms`}
        />
      </div>
      <div className="mt-8 grid gap-6 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <Section title="Insights by pack and severity">
            <Panel>
              {d.byPack.length ? (
                <SeverityByPackChart
                  rows={d.byPack.map((p) => ({ ...p, label: packLabel(p.key) }))}
                />
              ) : (
                <p className="text-sm text-ink-muted">No insights in this period.</p>
              )}
            </Panel>
          </Section>
          <Section title="Insights per day">
            <Panel>
              <DailyChart rows={d.byDay} />
            </Panel>
          </Section>
        </div>
        <div>
          <Section title="Customer responses">
            <Panel>
              <ResponsesChart
                rows={Object.entries(d.responses).map(([k, count]) => ({
                  label: RESPONSE_LABELS[k] ?? k,
                  count,
                }))}
              />
            </Panel>
          </Section>
          <Section title="How these are measured">
            <Panel className="space-y-2 text-xs text-ink-muted">
              <p>
                <strong className="text-ink">Reconsidered:</strong> the customer answered an action
                insight without continuing (chose another option, asked to talk to someone, or
                dismissed it).
              </p>
              <p>
                <strong className="text-ink">Value protected:</strong> the sum of each pack&apos;s
                computed value at stake (for example the avoidable loss on a card closure) on
                reconsidered insights. An estimate: AMIL never knows what the customer did next.
              </p>
              <p>
                <strong className="text-ink">Validator rejections:</strong> model wordings rejected
                by the number validator or copy policy and replaced by approved copy.
              </p>
            </Panel>
          </Section>
        </div>
      </div>
    </>
  );
}
