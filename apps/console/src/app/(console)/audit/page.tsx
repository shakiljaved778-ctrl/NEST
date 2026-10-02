import { Badge } from "@amil/ui";
import Link from "next/link";
import { VerifyChainButton } from "@/components/chain-check";
import { PageHeader, Panel } from "@/components/page-header";
import { adminGet, query } from "@/lib/api";
import { fmtDateTime, PACK_LABELS, packLabel } from "@/lib/labels";
import { can, requirePermission } from "@/lib/session";
import type { AuditSummary } from "@/lib/types";

type Search = { customerRef?: string; pack?: string; from?: string; to?: string; before?: string };

const isoDay = (d: string | undefined, end: boolean) =>
  d && /^\d{4}-\d{2}-\d{2}$/.test(d) ? `${d}T${end ? "23:59:59" : "00:00:00"}+03:00` : undefined;
const toIso = (d: string | undefined) => (d ? new Date(d).toISOString() : undefined);

export default async function AuditPage({ searchParams }: { searchParams: Promise<Search> }) {
  const me = await requirePermission("audit:read");
  const sp = await searchParams;
  const filters = {
    customerRef: sp.customerRef?.trim() || undefined,
    rulePackKey: sp.pack || undefined,
    from: toIso(isoDay(sp.from, false)),
    to: toIso(isoDay(sp.to, true)),
  };
  const { events, nextBefore } = await adminGet<{
    events: AuditSummary[];
    nextBefore: string | null;
  }>(`/audit${query({ ...filters, before: sp.before, limit: "50" })}`);
  const exportQ = query(filters);
  return (
    <>
      <PageHeader
        title="Audit"
        description="Every evaluation AMIL made, shown or suppressed, in an append-only hash chain kept for 10 years. Customer references are matched by keyed hash: the log never stores them."
        actions={<VerifyChainButton />}
      />
      <form className="mb-4 flex flex-wrap items-end gap-3" method="get">
        <div>
          <label className="label" htmlFor="a-ref">
            Customer reference
          </label>
          <input
            id="a-ref"
            name="customerRef"
            defaultValue={sp.customerRef ?? ""}
            className="field font-mono"
            placeholder="e.g. DDB-C-0001"
          />
        </div>
        <div>
          <label className="label" htmlFor="a-pack">
            Pack
          </label>
          <select id="a-pack" name="pack" defaultValue={sp.pack ?? ""} className="field">
            <option value="">All</option>
            {Object.entries(PACK_LABELS).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="a-from">
            From
          </label>
          <input
            id="a-from"
            type="date"
            name="from"
            defaultValue={sp.from ?? ""}
            className="field"
          />
        </div>
        <div>
          <label className="label" htmlFor="a-to">
            To
          </label>
          <input id="a-to" type="date" name="to" defaultValue={sp.to ?? ""} className="field" />
        </div>
        <button type="submit" className="h-[38px] rounded-md bg-brand px-4 text-sm text-white">
          Search
        </button>
        {can(me, "audit:export") ? (
          <span className="ms-auto flex gap-2 text-sm">
            <a
              className="rounded-md border border-line bg-white px-3 py-2 hover:border-brand"
              href={`/api/admin/audit/export${exportQ ? `${exportQ}&` : "?"}format=csv`}
            >
              Export CSV
            </a>
            <a
              className="rounded-md border border-line bg-white px-3 py-2 hover:border-brand"
              href={`/api/admin/audit/export${exportQ ? `${exportQ}&` : "?"}format=json`}
            >
              Export JSON
            </a>
          </span>
        ) : null}
      </form>
      <Panel className="p-0">
        <table className="data" data-testid="audit-results">
          <thead>
            <tr>
              <th>#</th>
              <th>When</th>
              <th>Pack</th>
              <th>Trigger</th>
              <th>Result</th>
              <th>What was shown</th>
              <th>Validator</th>
            </tr>
          </thead>
          <tbody>
            {events.map((e) => (
              <tr key={e.id}>
                <td className="tabular-nums">
                  <Link className="text-brand hover:underline" href={`/audit/${e.id}`}>
                    {e.seq}
                  </Link>
                </td>
                <td className="text-xs whitespace-nowrap">{fmtDateTime(e.occurredAt)}</td>
                <td className="text-xs">
                  {packLabel(e.rulePackKey)}
                  <span className="block text-ink-muted">
                    v{e.rulePackVersion} · {e.variant}
                  </span>
                </td>
                <td className="font-mono text-[11px]">{e.trigger}</td>
                <td>
                  {e.applicable ? (
                    <Badge tone={e.severity === "critical" ? "brand" : "neutral"}>
                      {e.severity ?? "shown"}
                    </Badge>
                  ) : (
                    <Badge tone="warning">{e.suppressed ?? "not applicable"}</Badge>
                  )}
                </td>
                <td className="max-w-sm text-xs" dir="auto">
                  {e.headline ?? "–"}
                </td>
                <td className="text-xs">{e.validatorResult.replace("_", " ")}</td>
              </tr>
            ))}
            {!events.length ? (
              <tr>
                <td colSpan={7} className="text-sm text-ink-muted">
                  No events match.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </Panel>
      {nextBefore ? (
        <p className="mt-4 text-sm">
          <Link
            className="text-brand hover:underline"
            href={`/audit${query({ ...sp, before: nextBefore })}`}
          >
            Older events
          </Link>
        </p>
      ) : null}
    </>
  );
}
