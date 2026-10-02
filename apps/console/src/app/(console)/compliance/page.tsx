import { Badge } from "@amil/ui";
import { Json, PageHeader, Panel, Section } from "@/components/page-header";
import { adminGet } from "@/lib/api";
import { fmtDateTime, packLabel } from "@/lib/labels";
import { requirePermission } from "@/lib/session";
import type { CompliancePack } from "@/lib/types";

/** Compliance pack (section 11), generated from the running configuration. Printable. */
export default async function CompliancePage() {
  await requirePermission("compliance:read");
  const c = await adminGet<CompliancePack>("/compliance");
  const conventional = c.packs.filter((p) => p.variant === "conventional");
  return (
    <>
      <PageHeader
        title="Compliance pack"
        description={`Generated ${fmtDateTime(c.generatedAt)} from ${c.bank.name}'s live configuration, so it cannot drift from what the system does.`}
      />
      <div className="grid gap-6 xl:grid-cols-2">
        <Section title="Model card">
          <Panel className="space-y-3 text-sm" data-testid="model-card">
            <p>{c.modelCard.purpose}</p>
            <p>
              Current mode: <Badge tone="brand">{c.modelCard.currentMode}</Badge> · prompt{" "}
              <span className="font-mono">{c.modelCard.promptVersion}</span> · deadline{" "}
              {c.modelCard.deadlineMs} ms · wording cache: {c.modelCard.wordingCache}
            </p>
            <p className="text-xs">
              Redacted provider:{" "}
              {c.modelCard.providers.redacted
                ? `${c.modelCard.providers.redacted.name} (${c.modelCard.providers.redacted.model})`
                : "none"}{" "}
              · In-country provider:{" "}
              {c.modelCard.providers.inCountry
                ? `${c.modelCard.providers.inCountry.name} (${c.modelCard.providers.inCountry.model})`
                : "none"}
            </p>
            <dl className="space-y-1 text-xs">
              {Object.entries(c.modelCard.modes).map(([k, v]) => (
                <div key={k}>
                  <dt className="inline font-mono font-medium">{k}</dt>:{" "}
                  <dd className="inline">{v}</dd>
                </div>
              ))}
            </dl>
            <ul className="list-disc space-y-1 ps-5 text-xs">
              {c.modelCard.safeguards.map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ul>
          </Panel>
        </Section>
        <Section title="Data flow">
          <Panel>
            <ol className="list-decimal space-y-1 ps-5 text-sm">
              {c.dataFlow.map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ol>
          </Panel>
        </Section>
        <Section title="Redaction proof: the exact outbound model payload">
          <Panel className="space-y-3">
            <p className="text-xs text-ink-muted">
              Built by the live redactor for a demo card closure. Only computed facts and approved
              reference wording leave; nothing identifies the customer.
            </p>
            <div data-testid="redaction-payload">
              <Json value={c.redaction.samplePayload} />
            </div>
            <p className="text-xs font-medium">Never sent to any model:</p>
            <ul className="list-disc ps-5 text-xs">
              {c.redaction.neverSent.map((f) => (
                <li key={f} className="font-mono">
                  {f}
                </li>
              ))}
            </ul>
          </Panel>
        </Section>
        <Section title="Retention and consent">
          <Panel className="space-y-3 text-sm">
            <p>
              Audit events are kept for <strong>{c.retention.auditRetentionYears} years</strong>.{" "}
              {c.retention.rule}
            </p>
            <table className="data">
              <thead>
                <tr>
                  <th>Consent purpose</th>
                  <th>Used for</th>
                </tr>
              </thead>
              <tbody>
                {c.consentPurposes.map((p) => (
                  <tr key={p.purpose}>
                    <td className="font-mono text-xs">{p.purpose}</td>
                    <td className="text-xs">{p.use}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Panel>
        </Section>
      </div>
      <Section title="Data fields each pack reads">
        <Panel className="p-0">
          <table className="data" data-testid="pack-fields">
            <thead>
              <tr>
                <th>Pack</th>
                <th>Triggers</th>
                <th>Reads</th>
                <th>Computes</th>
              </tr>
            </thead>
            <tbody>
              {conventional.map((p) => (
                <tr key={p.key}>
                  <td>
                    {packLabel(p.key)}
                    <p className="font-mono text-[11px] text-ink-muted">
                      {p.key} v{p.version} (both variants)
                    </p>
                  </td>
                  <td className="font-mono text-[11px]">
                    {p.triggers.map((t) => `${t.type}:${t.event}`).join(", ")}
                  </td>
                  <td className="text-xs">
                    {p.requiredData.map((r) => (
                      <p key={r.entity}>
                        <strong>{r.entity}</strong>: {r.fields.join(", ")}
                      </p>
                    ))}
                  </td>
                  <td className="font-mono text-[11px]">{p.facts.map((f) => f.key).join(", ")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>
      </Section>
    </>
  );
}
