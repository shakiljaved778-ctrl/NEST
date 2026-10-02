import { Badge } from "@amil/ui";
import Link from "next/link";
import { KillSwitch } from "@/components/kill-switch";
import { PageHeader, Panel, Section } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { TemplateEditor, Workflow } from "@/components/template-editor";
import { adminGet, query } from "@/lib/api";
import { fmtDateTime, packLabel } from "@/lib/labels";
import { can, requirePermission } from "@/lib/session";
import type { Template, TemplateDetail } from "@/lib/types";

export default async function TemplatePage({ params }: { params: Promise<{ id: string }> }) {
  const me = await requirePermission("templates:read");
  const { id } = await params;
  const { template: t, versions, history } = await adminGet<TemplateDetail>(`/templates/${id}`);
  const otherLocale = t.locale === "en" ? "ar" : "en";
  const { templates: siblings } = await adminGet<{ templates: Template[] }>(
    `/templates${query({ rulePackKey: t.rulePackKey, locale: otherLocale })}`,
  );
  const counterpart =
    siblings.find(
      (s) =>
        s.key === t.key &&
        s.severity === t.severity &&
        (s.status === "approved" || s.status === "sharia_approved"),
    ) ?? null;
  const live = t.status === "approved" || t.status === "sharia_approved";
  return (
    <>
      <p className="mb-2 text-sm">
        <Link href="/templates" className="text-brand hover:underline">
          Templates
        </Link>
      </p>
      <PageHeader
        title={`${packLabel(t.rulePackKey)} · ${t.severity} · ${t.locale.toUpperCase()}`}
        description={
          <>
            <span className="font-mono">{t.key}</span> · version {t.version} ·{" "}
            <StatusBadge status={t.status} />{" "}
            {t.variant === "islamic" ? <Badge tone="islamic">islamic</Badge> : null}
            {t.approvedAt ? ` · approved ${fmtDateTime(t.approvedAt)}` : ""}
          </>
        }
        actions={
          live ? (
            <KillSwitch
              path={`/templates/${t.id}`}
              enabled={t.enabled}
              canWrite={can(me, "killswitch:write")}
              name={`template ${t.key} (${t.locale})`}
            />
          ) : null
        }
      />
      <div className="mb-6">
        <Workflow template={t} permissions={me.permissions} />
        {t.variant === "islamic" && t.status === "in_review" ? (
          <p className="mt-2 text-xs text-ink-muted">
            Islamic copy goes live only after compliance and then the Sharia reviewer approve it.
          </p>
        ) : null}
      </div>
      <Panel>
        <TemplateEditor
          key={t.id}
          template={t}
          counterpart={counterpart}
          permissions={me.permissions}
        />
      </Panel>
      <div className="mt-8 grid gap-6 xl:grid-cols-2">
        <Section title="Versions">
          <Panel className="p-0">
            <table className="data">
              <tbody>
                {versions.map((v) => (
                  <tr key={v.id}>
                    <td className="tabular-nums">
                      {v.id === t.id ? (
                        <strong>v{v.version}</strong>
                      ) : (
                        <Link className="text-brand hover:underline" href={`/templates/${v.id}`}>
                          v{v.version}
                        </Link>
                      )}
                    </td>
                    <td>
                      <StatusBadge status={v.status} />
                    </td>
                    <td className="text-xs" dir={v.locale === "ar" ? "rtl" : "ltr"}>
                      {v.headline}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Panel>
        </Section>
        <Section title="Approval history">
          <Panel className="p-0">
            <table className="data" data-testid="approval-history">
              <tbody>
                {history.length ? (
                  history.map((h) => (
                    <tr key={h.id}>
                      <td className="text-xs whitespace-nowrap">{fmtDateTime(h.at)}</td>
                      <td className="text-xs">
                        {h.actor} ({h.role})
                      </td>
                      <td className="text-xs">
                        {h.action.replace(/_/g, " ")}
                        {h.toStatus ? ` → ${h.toStatus}` : ""}
                      </td>
                      <td className="text-xs text-ink-muted">{h.comment ?? ""}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td className="text-xs text-ink-muted">
                      Seeded as approved copy; no console changes yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </Panel>
        </Section>
      </div>
    </>
  );
}
