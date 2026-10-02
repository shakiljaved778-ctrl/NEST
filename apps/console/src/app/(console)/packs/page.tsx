import { Badge } from "@amil/ui";
import Link from "next/link";
import { KillSwitch } from "@/components/kill-switch";
import { PageHeader, Panel } from "@/components/page-header";
import { adminGet } from "@/lib/api";
import { fmtDateTime, packLabel } from "@/lib/labels";
import { can, requirePermission } from "@/lib/session";
import type { Pack } from "@/lib/types";

export default async function PacksPage() {
  const me = await requirePermission("packs:read");
  const { packs } = await adminGet<{ packs: Pack[] }>("/rule-packs");
  const canKill = can(me, "killswitch:write");
  return (
    <>
      <PageHeader
        title="Rule packs"
        description="Each pack computes one decision's facts with the bank's own parameters. Turn a pack off to stop it at once (customers see no insight, never an error); open a pack to change its parameters."
      />
      <Panel className="p-0">
        <table className="data">
          <thead>
            <tr>
              <th>Pack</th>
              <th>Variant</th>
              <th>Live version</th>
              <th>Effective from</th>
              <th>Scheduled</th>
              <th>Kill switch</th>
            </tr>
          </thead>
          <tbody>
            {packs.map((p) => {
              const name = `${packLabel(p.key)} (${p.variant})`;
              return (
                <tr key={`${p.key}:${p.variant}`} data-testid={`pack-${p.key}-${p.variant}`}>
                  <td>
                    <Link
                      className="font-medium text-brand hover:underline"
                      href={`/packs/${p.key}/${p.variant}`}
                    >
                      {packLabel(p.key)}
                    </Link>
                    <p className="text-xs text-ink-muted">{p.key}</p>
                  </td>
                  <td>
                    <Badge tone={p.variant === "islamic" ? "islamic" : "neutral"}>
                      {p.variant}
                    </Badge>
                  </td>
                  <td className="tabular-nums">{p.current?.version ?? "–"}</td>
                  <td className="text-xs">
                    {p.current ? fmtDateTime(p.current.effectiveFrom) : "–"}
                  </td>
                  <td className="text-xs">
                    {p.scheduled.length
                      ? p.scheduled
                          .map((s) => `${s.version} on ${fmtDateTime(s.effectiveFrom)}`)
                          .join(", ")
                      : "–"}
                  </td>
                  <td>
                    <KillSwitch
                      path={`/rule-packs/${p.key}/${p.variant}`}
                      enabled={p.current?.enabled ?? false}
                      canWrite={canKill}
                      name={name}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Panel>
    </>
  );
}
