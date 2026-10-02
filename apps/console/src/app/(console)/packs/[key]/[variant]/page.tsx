import { Badge } from "@amil/ui";
import Link from "next/link";
import { notFound } from "next/navigation";
import { KillSwitch } from "@/components/kill-switch";
import { PageHeader, Panel, Section } from "@/components/page-header";
import { ParamEditor } from "@/components/param-editor";
import { adminGet } from "@/lib/api";
import { fmtDateTime, packLabel } from "@/lib/labels";
import { can, requirePermission } from "@/lib/session";
import type { ApprovalEntry, Pack } from "@/lib/types";

function changedKeys(a: Record<string, unknown>, b: Record<string, unknown> | undefined) {
  if (!b) return [];
  return [...new Set([...Object.keys(a), ...Object.keys(b)])].filter(
    (k) => JSON.stringify(a[k]) !== JSON.stringify(b[k]),
  );
}

export default async function PackPage({
  params,
  searchParams,
}: {
  params: Promise<{ key: string; variant: string }>;
  searchParams: Promise<{ saved?: string }>;
}) {
  const me = await requirePermission("packs:read");
  const { key, variant } = await params;
  const { saved } = await searchParams;
  const [{ packs }, { entries }] = await Promise.all([
    adminGet<{ packs: Pack[] }>("/rule-packs"),
    adminGet<{ entries: ApprovalEntry[] }>("/approvals"),
  ]);
  const pack = packs.find((p) => p.key === key && p.variant === variant);
  if (!pack?.current) notFound();
  const versionIds = new Set(pack.versions.map((v) => v.id));
  const log = entries.filter(
    (e) =>
      e.entityType === "rule_pack" &&
      (versionIds.has(e.entityId) || e.entityId === `${key}:${variant}`),
  );
  const path = `/rule-packs/${key}/${variant}`;
  return (
    <>
      <p className="mb-2 text-sm">
        <Link href="/packs" className="text-brand hover:underline">
          Rule packs
        </Link>
      </p>
      <PageHeader
        title={`${packLabel(key)}`}
        description={
          <>
            <span className="font-mono">{key}</span> ·{" "}
            <Badge tone={variant === "islamic" ? "islamic" : "neutral"}>{variant}</Badge> · live
            version <strong>{pack.current.version}</strong> since{" "}
            {fmtDateTime(pack.current.effectiveFrom)}
          </>
        }
        actions={
          <KillSwitch
            path={path}
            enabled={pack.current.enabled}
            canWrite={can(me, "killswitch:write")}
            name={`${packLabel(key)} (${variant})`}
          />
        }
      />
      <div className="grid gap-6 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <Section title="Parameters">
            {saved ? (
              <p
                role="status"
                className="mb-3 rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800"
              >
                Saved as version {saved}. It applies from its effective date; the next check uses
                it.
              </p>
            ) : null}
            <Panel>
              <ParamEditor
                key={pack.current.id}
                path={path}
                current={{
                  ...pack.current,
                  parameters: { ...pack.defaults, ...pack.current.parameters },
                }}
                defaults={pack.defaults}
                canWrite={can(me, "packs:write")}
              />
            </Panel>
          </Section>
          {pack.scheduled.length ? (
            <Section title="Scheduled">
              <Panel>
                <ul className="text-sm">
                  {pack.scheduled.map((s) => (
                    <li key={s.id}>
                      Version {s.version} takes effect {fmtDateTime(s.effectiveFrom)}
                    </li>
                  ))}
                </ul>
              </Panel>
            </Section>
          ) : null}
          <Section title="Version history">
            <Panel className="p-0">
              <table className="data" data-testid="version-history">
                <thead>
                  <tr>
                    <th>Version</th>
                    <th>Effective from</th>
                    <th>By</th>
                    <th>Changed</th>
                  </tr>
                </thead>
                <tbody>
                  {pack.versions.map((v, i) => (
                    <tr key={v.id}>
                      <td className="tabular-nums">
                        {v.version}{" "}
                        {v.id === pack.current?.id ? <Badge tone="brand">live</Badge> : null}
                      </td>
                      <td className="text-xs">{fmtDateTime(v.effectiveFrom)}</td>
                      <td className="text-xs">{v.createdBy}</td>
                      <td className="font-mono text-xs">
                        {changedKeys(v.parameters, pack.versions[i + 1]?.parameters)
                          .map(
                            (k) =>
                              `${k}: ${JSON.stringify(pack.versions[i + 1]?.parameters[k] ?? null)} → ${JSON.stringify(v.parameters[k] ?? null)}`,
                          )
                          .join("; ") || "–"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Panel>
          </Section>
          <Section title="Change log">
            <Panel className="p-0">
              <table className="data">
                <tbody>
                  {log.length ? (
                    log.map((e) => (
                      <tr key={e.id}>
                        <td className="text-xs whitespace-nowrap">{fmtDateTime(e.at)}</td>
                        <td className="text-xs">
                          {e.actor} ({e.role})
                        </td>
                        <td className="text-xs">
                          {e.action.replace(/_/g, " ")}
                          {e.toStatus ? ` → ${e.toStatus}` : ""}
                        </td>
                        <td className="text-xs text-ink-muted">{e.comment ?? ""}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td className="text-xs text-ink-muted">No console changes yet.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </Panel>
          </Section>
        </div>
        <div>
          <Section title="Triggers">
            <Panel className="text-sm">
              {pack.triggers.map((t) => (
                <p key={`${t.type}:${t.event}`}>
                  <span className="text-ink-muted">{t.type}:</span>{" "}
                  <span className="font-mono">{t.event}</span>
                </p>
              ))}
            </Panel>
          </Section>
          <Section title="Data it reads">
            <Panel className="space-y-2 text-sm">
              {pack.requiredData.map((r) => (
                <p key={r.entity}>
                  <strong>{r.entity}</strong>:{" "}
                  <span className="font-mono text-xs">{r.fields.join(", ")}</span>
                </p>
              ))}
            </Panel>
          </Section>
          <Section title="Facts it computes">
            <Panel className="space-y-2 text-xs">
              {pack.facts.map((f) => (
                <p key={f.key}>
                  <span className="font-mono font-medium">{f.key}</span>{" "}
                  <span className="text-ink-muted">
                    ({f.unit}, {f.source}): {f.description}
                  </span>
                </p>
              ))}
            </Panel>
          </Section>
        </div>
      </div>
    </>
  );
}
