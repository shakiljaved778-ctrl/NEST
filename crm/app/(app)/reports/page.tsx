import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { isManagerial, seesAll } from "@/lib/rbac";
import {
  funnel,
  pipelineByStage,
  leaderboard,
  leadSourcePerformance,
  slaCompliance,
  winLossReasons,
  repSummary,
  type ReportFilters as RF,
} from "@/lib/services/reports";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ReportFilters } from "@/components/reports/report-filters";
import { FunnelChartCard, PipelineBarChart, SourcePieChart, HBarChart, PALETTE } from "@/components/reports/charts";
import { ExportButton } from "@/components/export-button";
import { fmtMoney, fmtNumber } from "@/lib/utils";

export const metadata = { title: "Reports" };
export const dynamic = "force-dynamic";

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const user = await requireUser();
  const sp = await searchParams;
  const filters: RF = {
    dateFrom: sp.dateFrom,
    dateTo: sp.dateTo,
    teamId: sp.teamId,
    ownerId: sp.ownerId,
    territory: sp.territory,
  };
  const qs = new URLSearchParams(sp as Record<string, string>).toString();

  const [teams, reps] = await Promise.all([
    db.team.findMany({ where: { deletedAt: null }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    db.user.findMany({
      where: { active: true, deletedAt: null, role: { in: ["REP", "TEAM_LEAD"] } },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);

  const managerView = isManagerial(user.role) || user.role === "TEAM_LEAD" || seesAll(user.role);

  if (!managerView) {
    // ── Rep dashboard ──────────────────────────────────────────────────────
    const summary = await repSummary(user, user.id, filters);
    const f = summary.funnel;
    const funnelData = [
      { name: "Leads", value: f.leads, fill: PALETTE[0] },
      { name: "Contacted", value: f.contacted, fill: PALETTE[1] },
      { name: "Qualified", value: f.qualified, fill: PALETTE[2] },
      { name: "Won", value: f.won, fill: PALETTE[5] },
    ];
    const quotaPct = summary.quota ? Math.round((summary.closedThisMonth / summary.quota) * 100) : 0;
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold">My performance</h1>
        <ReportFilters teams={teams} reps={reps} showTeamRep={false} />
        <div className="grid gap-3 sm:grid-cols-4">
          <Stat label="Quota (month)" value={fmtMoney(summary.quota)} />
          <Stat label="Closed this month" value={fmtMoney(summary.closedThisMonth)} sub={`${quotaPct}% of quota`} />
          <Stat label="Task completion" value={`${summary.taskCompletion}%`} sub={`${summary.tasksDone} done / ${summary.tasksOpen} open`} />
          <Stat label="Upcoming renewals" value={fmtNumber(summary.upcomingRenewals)} />
        </div>
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-base">My funnel</CardTitle></CardHeader>
          <CardContent><FunnelChartCard data={funnelData} /></CardContent>
        </Card>
      </div>
    );
  }

  // ── Manager dashboard ────────────────────────────────────────────────────
  const [f, pipeline, board, sources, sla, reasons] = await Promise.all([
    funnel(user, filters),
    pipelineByStage(user, filters),
    leaderboard(user, filters),
    leadSourcePerformance(user, filters),
    slaCompliance(user, filters),
    winLossReasons(user, filters),
  ]);

  const funnelData = [
    { name: "Leads", value: f.leads, fill: PALETTE[0] },
    { name: "Contacted", value: f.contacted, fill: PALETTE[1] },
    { name: "Qualified", value: f.qualified, fill: PALETTE[2] },
    { name: "Converted", value: f.converted, fill: PALETTE[3] },
    { name: "Won", value: f.won, fill: PALETTE[5] },
  ];
  const pipelineTotal = pipeline.reduce((s, p) => s + p.value, 0);
  const weightedTotal = pipeline.reduce((s, p) => s + p.weighted, 0);
  const convRate = f.leads ? Math.round((f.converted / f.leads) * 100) : 0;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Reports &amp; dashboards</h1>
        <ExportButton href={`/api/reports/export?${qs}`} />
      </div>
      <ReportFilters teams={teams} reps={reps} />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Lead → won conversion" value={`${convRate}%`} sub={`${f.converted} of ${f.leads} leads`} />
        <Stat label="Open pipeline" value={fmtMoney(pipelineTotal)} sub={`${f.openDeals} deals`} />
        <Stat label="Weighted forecast" value={fmtMoney(weightedTotal)} />
        <Stat label="SLA compliance" value={`${sla.complianceRate}%`} sub={`${sla.breached} breaches`} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Conversion funnel</CardTitle>
            <CardDescription>Lead → qualified → won</CardDescription>
          </CardHeader>
          <CardContent><FunnelChartCard data={funnelData} /></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Pipeline value by stage</CardTitle>
            <CardDescription>Open deals, raw vs. probability-weighted</CardDescription>
          </CardHeader>
          <CardContent><PipelineBarChart data={pipeline} /></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Lead source performance</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-2">
            <SourcePieChart data={sources} />
            <div className="space-y-1 self-center text-sm">
              {sources.map((s, i) => (
                <div key={s.source} className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <span className="inline-block h-2 w-2 rounded-full" style={{ background: PALETTE[i % PALETTE.length] }} />
                    {s.source}
                  </span>
                  <span className="text-muted-foreground">{s.total} · {s.conversionRate}%</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Win / loss reasons</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="mb-1 text-xs font-medium text-muted-foreground">Loss reasons</p>
            {reasons.losses.length === 0 ? (
              <p className="text-sm text-muted-foreground">No losses in range</p>
            ) : (
              <HBarChart data={reasons.losses.map((r) => ({ label: r.reason, value: r.count }))} />
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Rep leaderboard</CardTitle>
          <CardDescription>Ranked by revenue in the selected range</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>#</TableHead>
                <TableHead>Rep</TableHead>
                <TableHead>Team</TableHead>
                <TableHead className="text-end">Activities</TableHead>
                <TableHead className="text-end">Deals won</TableHead>
                <TableHead className="text-end">Revenue</TableHead>
                <TableHead className="text-end">Quota attainment</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {board.map((rep, i) => (
                <TableRow key={rep.id}>
                  <TableCell className="text-muted-foreground">{i + 1}</TableCell>
                  <TableCell className="font-medium">{rep.name}</TableCell>
                  <TableCell className="text-muted-foreground">{rep.team}</TableCell>
                  <TableCell className="text-end">{fmtNumber(rep.activities)}</TableCell>
                  <TableCell className="text-end">{rep.dealsWon}</TableCell>
                  <TableCell className="text-end font-medium">{fmtMoney(rep.revenue)}</TableCell>
                  <TableCell className="text-end">
                    {rep.quota ? (
                      <Badge variant={rep.revenue >= rep.quota ? "success" : "secondary"}>
                        {Math.round((rep.revenue / rep.quota) * 100)}%
                      </Badge>
                    ) : "—"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="mt-1 text-2xl font-semibold">{value}</p>
        {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
      </CardContent>
    </Card>
  );
}
