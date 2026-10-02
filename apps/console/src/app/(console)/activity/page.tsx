import { Badge } from "@amil/ui";
import { PageHeader, Panel } from "@/components/page-header";
import { adminGet } from "@/lib/api";
import { fmtDateTime } from "@/lib/labels";
import { requirePermission } from "@/lib/session";

interface Entry {
  id: string;
  kind: "activity" | "change";
  action: string;
  actor: string;
  role: string;
  at: string;
  detail: Record<string, unknown> | null;
}

const describe = (d: Record<string, unknown> | null) =>
  d
    ? Object.entries(d)
        .filter(([, v]) => v !== undefined && v !== null)
        .map(([k, v]) =>
          k === "customerRefHash" ? `customer ${String(v).slice(0, 12)}…` : `${k}: ${String(v)}`,
        )
        .join(" · ")
    : "";

/** Who did what in the console (D-068): changes, sign-ins and customer-level reads and exports. */
export default async function ActivityPage() {
  await requirePermission("audit:read");
  const { entries } = await adminGet<{ entries: Entry[] }>("/activity");
  return (
    <>
      <PageHeader
        title="Console activity"
        description="Every change made in the console, every sign-in, and every look at customer-level data (audit searches, event views, exports, complaints lookups). Append-only; customer references appear only as their keyed hash."
      />
      <Panel className="p-0">
        <table className="data" data-testid="activity">
          <thead>
            <tr>
              <th>When</th>
              <th>Who</th>
              <th>What</th>
              <th>Detail</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((e) => (
              <tr key={e.id}>
                <td className="text-xs whitespace-nowrap">{fmtDateTime(e.at)}</td>
                <td className="text-xs">
                  {e.actor} <span className="text-ink-muted">({e.role})</span>
                </td>
                <td className="text-xs">
                  <Badge tone={e.kind === "change" ? "brand" : "neutral"}>
                    {e.kind === "change" ? "change" : "access"}
                  </Badge>{" "}
                  {e.action.replace(/_/g, " ")}
                </td>
                <td className="font-mono text-[11px] text-ink-muted">{describe(e.detail)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Panel>
    </>
  );
}
