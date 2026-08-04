import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { dealScope, leadScope, type SessionUser } from "@/lib/rbac";

export interface ReportFilters {
  dateFrom?: string;
  dateTo?: string;
  teamId?: string;
  ownerId?: string;
  territory?: string;
}

function dateRange(filters: ReportFilters): { gte?: Date; lte?: Date } | undefined {
  if (!filters.dateFrom && !filters.dateTo) return undefined;
  return {
    ...(filters.dateFrom ? { gte: new Date(filters.dateFrom) } : {}),
    ...(filters.dateTo ? { lte: new Date(filters.dateTo + "T23:59:59Z") } : {}),
  };
}

/** Compose report filters into lead/deal where clauses with RBAC scope. */
async function scopedWheres(user: SessionUser, filters: ReportFilters) {
  const range = dateRange(filters);
  const leadWhere: Prisma.LeadWhereInput = {
    deletedAt: null,
    ...(await leadScope(user)),
    ...(filters.ownerId ? { ownerId: filters.ownerId } : {}),
    ...(filters.teamId ? { teamId: filters.teamId } : {}),
    ...(filters.territory ? { territory: filters.territory } : {}),
    ...(range ? { createdAt: range } : {}),
  };
  const dealWhere: Prisma.DealWhereInput = {
    deletedAt: null,
    ...(await dealScope(user)),
    ...(filters.ownerId ? { ownerId: filters.ownerId } : {}),
    ...(filters.teamId ? { teamId: filters.teamId } : {}),
    ...(range ? { createdAt: range } : {}),
  };
  return { leadWhere, dealWhere };
}

export interface FunnelData {
  leads: number;
  contacted: number;
  qualified: number;
  converted: number;
  disqualified: number;
  won: number;
  lost: number;
  openDeals: number;
}

export async function funnel(user: SessionUser, filters: ReportFilters): Promise<FunnelData> {
  const { leadWhere, dealWhere } = await scopedWheres(user, filters);
  const [byStatus, deals] = await Promise.all([
    db.lead.groupBy({ by: ["status"], where: leadWhere, _count: true }),
    db.deal.groupBy({ by: ["status"], where: dealWhere, _count: true }),
  ]);
  const s = (status: string) => byStatus.find((r) => r.status === status)?._count ?? 0;
  const d = (status: string) => deals.find((r) => r.status === status)?._count ?? 0;
  const total = byStatus.reduce((sum, r) => sum + r._count, 0);
  return {
    leads: total,
    contacted: s("CONTACTED") + s("QUALIFIED") + s("CONVERTED"),
    qualified: s("QUALIFIED") + s("CONVERTED"),
    converted: s("CONVERTED"),
    disqualified: s("DISQUALIFIED"),
    won: d("WON"),
    lost: d("LOST"),
    openDeals: d("OPEN"),
  };
}

export async function pipelineByStage(user: SessionUser, filters: ReportFilters) {
  const { dealWhere } = await scopedWheres(user, filters);
  const stages = await db.stage.findMany({
    where: { deletedAt: null, type: "OPEN" },
    orderBy: { sortOrder: "asc" },
    select: { id: true, name: true, probability: true },
  });
  const deals = await db.deal.findMany({
    where: { ...dealWhere, status: "OPEN" },
    select: { stageId: true, value: true, fxRateToQar: true },
  });
  return stages.map((stage) => {
    const stageDeals = deals.filter((d) => d.stageId === stage.id);
    const value = stageDeals.reduce((s, d) => s + d.value * d.fxRateToQar, 0);
    return {
      stage: stage.name,
      count: stageDeals.length,
      value,
      weighted: value * (stage.probability / 100),
    };
  });
}

export async function leaderboard(user: SessionUser, filters: ReportFilters) {
  const { dealWhere } = await scopedWheres(user, filters);
  const range = dateRange(filters);

  const reps = await db.user.findMany({
    where: {
      deletedAt: null,
      role: { in: ["REP", "TEAM_LEAD"] },
      ...(filters.teamId ? { teamId: filters.teamId } : {}),
      ...(filters.ownerId ? { id: filters.ownerId } : {}),
    },
    select: { id: true, name: true, quotaMonthly: true, team: { select: { name: true } } },
  });

  const results = await Promise.all(
    reps.map(async (rep) => {
      const [wonAgg, activities] = await Promise.all([
        db.deal.aggregate({
          where: { ...dealWhere, ownerId: rep.id, status: "WON", ...(range ? { wonAt: range } : {}) },
          _count: true,
          _sum: { value: true },
        }),
        db.activity.count({ where: { userId: rep.id, deletedAt: null, ...(range ? { occurredAt: range } : {}) } }),
      ]);
      return {
        id: rep.id,
        name: rep.name,
        team: rep.team?.name ?? "—",
        quota: rep.quotaMonthly,
        dealsWon: wonAgg._count,
        revenue: wonAgg._sum.value ?? 0,
        activities,
      };
    })
  );
  return results.sort((a, b) => b.revenue - a.revenue);
}

export async function leadSourcePerformance(user: SessionUser, filters: ReportFilters) {
  const { leadWhere } = await scopedWheres(user, filters);
  const bySource = await db.lead.groupBy({ by: ["source", "status"], where: leadWhere, _count: true });
  const sources = new Map<string, { total: number; converted: number }>();
  for (const row of bySource) {
    const entry = sources.get(row.source) ?? { total: 0, converted: 0 };
    entry.total += row._count;
    if (row.status === "CONVERTED") entry.converted += row._count;
    sources.set(row.source, entry);
  }
  return Array.from(sources.entries())
    .map(([source, v]) => ({
      source,
      total: v.total,
      converted: v.converted,
      conversionRate: v.total ? Math.round((v.converted / v.total) * 100) : 0,
    }))
    .sort((a, b) => b.total - a.total);
}

export async function slaCompliance(user: SessionUser, filters: ReportFilters) {
  const { leadWhere } = await scopedWheres(user, filters);
  // Consider only leads that had an SLA due time (i.e. were routed with a timer)
  const withSla = { ...leadWhere, slaDueAt: { not: null } as Prisma.LeadWhereInput["slaDueAt"] };
  const [total, breached, touchedOnTime] = await Promise.all([
    db.lead.count({ where: withSla }),
    db.lead.count({ where: { ...withSla, slaBreachedAt: { not: null } } }),
    db.lead.count({
      where: {
        ...withSla,
        firstTouchAt: { not: null },
        slaBreachedAt: null,
      },
    }),
  ]);
  const rate = total ? Math.round((touchedOnTime / total) * 100) : 100;
  return { total, breached, touchedOnTime, complianceRate: rate };
}

export async function winLossReasons(user: SessionUser, filters: ReportFilters) {
  const { dealWhere } = await scopedWheres(user, filters);
  const [losses, wins] = await Promise.all([
    db.deal.groupBy({ by: ["lossReason"], where: { ...dealWhere, status: "LOST" }, _count: true }),
    db.deal.groupBy({ by: ["winReason"], where: { ...dealWhere, status: "WON" }, _count: true }),
  ]);
  return {
    losses: losses.map((r) => ({ reason: r.lossReason ?? "Unspecified", count: r._count })).sort((a, b) => b.count - a.count),
    wins: wins.map((r) => ({ reason: r.winReason ?? "Unspecified", count: r._count })).sort((a, b) => b.count - a.count),
  };
}

/** Per-rep personal dashboard summary. */
export async function repSummary(user: SessionUser, repId: string, filters: ReportFilters) {
  const range = dateRange(filters);
  const monthStart = new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), 1));
  const [funnelData, quotaUser, wonThisMonth, tasksAgg, renewals] = await Promise.all([
    funnel(user, { ...filters, ownerId: repId }),
    db.user.findUnique({ where: { id: repId }, select: { quotaMonthly: true } }),
    db.deal.aggregate({ where: { ownerId: repId, status: "WON", deletedAt: null, wonAt: { gte: monthStart } }, _sum: { value: true } }),
    db.task.groupBy({ by: ["status"], where: { ownerId: repId, deletedAt: null, ...(range ? { createdAt: range } : {}) }, _count: true }),
    db.subscription.count({
      where: {
        deletedAt: null,
        status: "ACTIVE",
        renewalDate: { gte: new Date(), lte: new Date(Date.now() + 60 * 86_400_000) },
        OR: [{ account: { ownerId: repId } }, { contact: { ownerId: repId } }],
      },
    }),
  ]);
  const done = tasksAgg.find((t) => t.status === "DONE")?._count ?? 0;
  const open = tasksAgg.find((t) => t.status === "OPEN")?._count ?? 0;
  return {
    funnel: funnelData,
    quota: quotaUser?.quotaMonthly ?? 0,
    closedThisMonth: wonThisMonth._sum.value ?? 0,
    tasksDone: done,
    tasksOpen: open,
    taskCompletion: done + open ? Math.round((done / (done + open)) * 100) : 0,
    upcomingRenewals: renewals,
  };
}
