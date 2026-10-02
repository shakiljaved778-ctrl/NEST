import { Badge } from "@amil/ui";
import Link from "next/link";
import { PageHeader, Panel } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { adminGet } from "@/lib/api";
import { packLabel, STATUS_LABELS } from "@/lib/labels";
import { requirePermission } from "@/lib/session";
import type { Me, Template } from "@/lib/types";

/** What waits on each role in the approval workflow. */
const QUEUE: Record<string, { status: string; label: string } | undefined> = {
  product: { status: "draft", label: "Drafts to submit" },
  compliance: { status: "in_review", label: "Waiting for compliance" },
  sharia: { status: "compliance_approved", label: "Waiting for Sharia approval" },
};

export default async function TemplatesPage({
  searchParams,
}: {
  searchParams: Promise<{ pack?: string; locale?: string; status?: string }>;
}) {
  const me: Me = await requirePermission("templates:read");
  const sp = await searchParams;
  const status = sp.status ?? "live";
  // One read (a few hundred rows), filtered here so the pack list stays complete.
  const { templates: all } = await adminGet<{ templates: Template[] }>("/templates");
  const templates = all.filter(
    (t) =>
      (!sp.pack || t.rulePackKey === sp.pack) &&
      (!sp.locale || t.locale === sp.locale) &&
      (status === "all" ||
        (status === "live"
          ? t.status === "approved" || t.status === "sharia_approved"
          : t.status === status)),
  );
  const packs = [...new Set(all.map((t) => t.rulePackKey))].sort();
  const queue = QUEUE[me.user.role];
  return (
    <>
      <PageHeader
        title="Templates"
        description="Every word a customer sees is bank-approved copy: product drafts, compliance approves, and Islamic copy also needs Sharia approval. Figures are never typed into copy; they come from computed facts."
        actions={
          queue ? (
            <Link
              href={`/templates?status=${queue.status}`}
              className="rounded-md border border-line bg-white px-3 py-2 text-sm hover:border-brand"
            >
              {queue.label}
            </Link>
          ) : null
        }
      />
      <form className="mb-4 flex flex-wrap items-end gap-3" method="get">
        <div>
          <label className="label" htmlFor="f-pack">
            Pack
          </label>
          <select id="f-pack" name="pack" defaultValue={sp.pack ?? ""} className="field">
            <option value="">All</option>
            {packs.map((p) => (
              <option key={p} value={p}>
                {packLabel(p)}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="f-locale">
            Language
          </label>
          <select id="f-locale" name="locale" defaultValue={sp.locale ?? ""} className="field">
            <option value="">Both</option>
            <option value="en">English</option>
            <option value="ar">Arabic</option>
          </select>
        </div>
        <div>
          <label className="label" htmlFor="f-status">
            Status
          </label>
          <select id="f-status" name="status" defaultValue={status} className="field">
            <option value="live">Live (approved)</option>
            <option value="all">All</option>
            {Object.entries(STATUS_LABELS).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </div>
        <button type="submit" className="h-[38px] rounded-md bg-brand px-4 text-sm text-white">
          Filter
        </button>
      </form>
      <Panel className="p-0">
        <table className="data">
          <thead>
            <tr>
              <th>Template</th>
              <th>Lang</th>
              <th>Severity</th>
              <th>Headline</th>
              <th>Version</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {templates.map((t) => (
              <tr key={t.id}>
                <td>
                  <Link className="text-brand hover:underline" href={`/templates/${t.id}`}>
                    {packLabel(t.rulePackKey)}
                  </Link>
                  <p className="font-mono text-[11px] text-ink-muted">{t.key}</p>
                  {t.variant === "islamic" ? <Badge tone="islamic">islamic</Badge> : null}
                </td>
                <td className="uppercase">{t.locale}</td>
                <td className="text-xs">{t.severity}</td>
                <td
                  className="max-w-md text-xs"
                  dir={t.locale === "ar" ? "rtl" : "ltr"}
                  lang={t.locale}
                >
                  {t.headline}
                </td>
                <td className="tabular-nums">{t.version}</td>
                <td>
                  <StatusBadge status={t.status} />
                  {!t.enabled ? (
                    <Badge tone="warning" className="ml-1">
                      off
                    </Badge>
                  ) : null}
                </td>
              </tr>
            ))}
            {!templates.length ? (
              <tr>
                <td colSpan={6} className="text-sm text-ink-muted">
                  No templates match.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </Panel>
    </>
  );
}
