import { requireRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { getSlaSettings } from "@/lib/settings";
import { RoutingManager } from "@/components/admin/routing-manager";
import { SlaSettingsForm } from "@/components/admin/sla-settings";

export const metadata = { title: "Admin · Routing & SLA" };
export const dynamic = "force-dynamic";

export default async function AdminRoutingPage() {
  await requireRole("ADMIN");
  const [rules, teams, reps, products, sla] = await Promise.all([
    db.leadRoutingRule.findMany({
      where: { deletedAt: null },
      include: { targetTeam: { select: { name: true } }, targetRep: { select: { name: true } } },
      orderBy: [{ isFallback: "asc" }, { priority: "asc" }],
    }),
    db.team.findMany({ where: { deletedAt: null }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    db.user.findMany({ where: { active: true, deletedAt: null, role: { in: ["REP", "TEAM_LEAD"] } }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    db.product.findMany({ where: { active: true, deletedAt: null }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    getSlaSettings(),
  ]);

  return (
    <div className="space-y-6">
      <section className="space-y-2">
        <h2 className="text-lg font-medium">SLA timers</h2>
        <p className="text-sm text-muted-foreground">First-touch target and escalation behaviour applied to every routed lead.</p>
        <SlaSettingsForm settings={sla} />
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-medium">Lead routing rules</h2>
        <p className="text-sm text-muted-foreground">
          Evaluated in priority order (lowest first); the fallback rule catches anything unmatched. Round-robin skips
          inactive and on-leave reps.
        </p>
        <RoutingManager
          rules={rules.map((r) => ({
            id: r.id, name: r.name, priority: r.priority, active: r.active, isFallback: r.isFallback,
            criteria: r.criteria as Record<string, unknown>, targetType: r.targetType,
            targetTeamId: r.targetTeamId, targetRepId: r.targetRepId,
            targetLabel: r.targetType === "REP" ? (r.targetRep?.name ?? "—") : (r.targetTeam?.name ?? "—"),
          }))}
          teams={teams}
          reps={reps}
          products={products}
        />
      </section>
    </div>
  );
}
