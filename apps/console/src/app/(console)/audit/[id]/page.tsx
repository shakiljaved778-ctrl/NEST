import Link from "next/link";
import { Json, PageHeader, Panel, Section } from "@/components/page-header";
import { adminGet } from "@/lib/api";
import { fmtDateTime, packLabel, RESPONSE_LABELS } from "@/lib/labels";
import { requirePermission } from "@/lib/session";
import type { AuditEventDetail, FactView } from "@/lib/types";

/** Units worth printing next to a value (dates, counts, booleans and codes speak for themselves). */
const UNIT: Record<string, string> = {
  QAR: "QAR",
  points: "points",
  days: "days",
  months: "months",
  percent: "%",
};

const Check = ({ ok, label }: { ok: boolean; label: string }) => (
  <p className={`text-sm ${ok ? "text-emerald-700" : "text-red-700"}`}>
    {ok ? "✓" : "✗"} {label}
  </p>
);

export default async function AuditEventPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePermission("audit:read");
  const { id } = await params;
  const { event: e, responses, chain } = await adminGet<AuditEventDetail>(`/audit/${id}`);
  const shown = (e.shown ?? {}) as {
    body?: unknown;
    description?: unknown;
    answer?: { body?: unknown };
  };
  const shownBody = [shown.body, shown.answer?.body, shown.description].find(
    (b): b is string => typeof b === "string",
  );
  const facts = Object.entries(e.facts).filter(([k]) => k !== "_sources") as [string, FactView][];
  return (
    <>
      <p className="mb-2 text-sm">
        <Link href="/audit" className="text-brand hover:underline">
          Audit
        </Link>
      </p>
      <PageHeader
        title={`Event #${e.seq}`}
        description={`${packLabel(e.rulePackKey)} · ${e.trigger} · ${fmtDateTime(e.occurredAt)}`}
      />
      <div className="grid gap-6 xl:grid-cols-3">
        <div className="space-y-6 xl:col-span-2">
          <Section title="What the customer saw">
            <Panel>
              {e.headline ? (
                <p className="font-semibold" dir="auto">
                  {e.headline}
                </p>
              ) : (
                <p className="text-sm text-ink-muted">
                  Nothing was shown ({e.suppressed ?? "not applicable"}).
                </p>
              )}
              {shownBody ? (
                <p className="mt-1 text-sm whitespace-pre-line" dir="auto">
                  {shownBody}
                </p>
              ) : null}
              <details className="mt-3">
                <summary className="cursor-pointer text-xs text-ink-muted">
                  Full record of what was shown
                </summary>
                <div className="mt-2">
                  <Json value={e.shown} />
                </div>
              </details>
            </Panel>
          </Section>
          <Section title="Computed facts">
            <Panel className="p-0">
              <table className="data">
                <thead>
                  <tr>
                    <th>Fact</th>
                    <th>Value</th>
                    <th>Source</th>
                    <th>As of</th>
                  </tr>
                </thead>
                <tbody>
                  {facts.map(([k, f]) => (
                    <tr key={k}>
                      <td className="font-mono text-xs">{k}</td>
                      <td className="tabular-nums">
                        {f.value ?? JSON.stringify(f)} {UNIT[f.unit ?? ""] ?? ""}
                      </td>
                      <td className="text-xs">{f.source ?? ""}</td>
                      <td className="text-xs">{f.asOf ?? ""}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Panel>
          </Section>
        </div>
        <div className="space-y-6">
          <Section title="Integrity">
            <Panel className="space-y-1" data-testid="event-chain">
              <Check ok={chain.hashValid} label="Content matches its hash" />
              <Check ok={chain.linkValid} label="Linked to the previous event" />
              <p className="mt-2 text-[11px] break-all text-ink-muted">hash {e.hash}</p>
              <p className="text-[11px] break-all text-ink-muted">prev {e.prevHash}</p>
            </Panel>
          </Section>
          <Section title="Customer response">
            <Panel>
              {responses.length ? (
                <ul className="space-y-1 text-sm">
                  {responses.map((r) => (
                    <li key={r.id}>
                      {RESPONSE_LABELS[r.action] ?? r.action}
                      {r.optionKey ? `: ${r.optionKey}` : ""}{" "}
                      <span className="text-xs text-ink-muted">{fmtDateTime(r.at)}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-ink-muted">No response recorded.</p>
              )}
            </Panel>
          </Section>
          <Section title="Record">
            <Panel className="space-y-1 text-xs">
              <p>
                Pack {e.rulePackKey} v{e.rulePackVersion} ({e.variant})
              </p>
              <p>
                Template {e.templateKey ?? "–"}
                {e.templateVersion ? ` v${e.templateVersion}` : ""} · {e.locale}
              </p>
              <p>
                Model {e.modelProvider ?? "none"}
                {e.modelVersion ? ` (${e.modelVersion})` : ""} · validator {e.validatorResult}
              </p>
              <p>Latency {e.latencyMs ?? "–"} ms</p>
              <p className="break-all">Customer ref hash {e.customerRefHash}</p>
              <p className="break-all">Input snapshot hash {e.inputSnapshotHash}</p>
              <p>Retained until {fmtDateTime(e.retentionUntil)}</p>
            </Panel>
          </Section>
        </div>
      </div>
    </>
  );
}
