import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { leaderboard, funnel, pipelineByStage, slaCompliance, type ReportFilters } from "@/lib/services/reports";
import { logAudit } from "@/lib/audit";
import { toCsv } from "@/lib/utils";

// Exports the leaderboard plus headline funnel/pipeline/SLA metrics as CSV.
export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = session.user;

  const sp = new URL(req.url).searchParams;
  const filters: ReportFilters = {
    dateFrom: sp.get("dateFrom") ?? undefined,
    dateTo: sp.get("dateTo") ?? undefined,
    teamId: sp.get("teamId") ?? undefined,
    ownerId: sp.get("ownerId") ?? undefined,
    territory: sp.get("territory") ?? undefined,
  };

  const [board, f, pipeline, sla] = await Promise.all([
    leaderboard(user, filters),
    funnel(user, filters),
    pipelineByStage(user, filters),
    slaCompliance(user, filters),
  ]);

  await logAudit({ action: "EXPORT", entityType: "USER", actorId: user.id, actorEmail: user.email, after: { report: "dashboard" } });

  const lines: string[] = [];
  lines.push("Funnel");
  lines.push(toCsv(["Stage", "Count"], [
    ["Leads", f.leads], ["Contacted", f.contacted], ["Qualified", f.qualified],
    ["Converted", f.converted], ["Won", f.won], ["Lost", f.lost],
  ]));
  lines.push("");
  lines.push("Pipeline by stage");
  lines.push(toCsv(["Stage", "Deals", "Value (QAR)", "Weighted (QAR)"], pipeline.map((p) => [p.stage, p.count, Math.round(p.value), Math.round(p.weighted)])));
  lines.push("");
  lines.push(`SLA compliance,${sla.complianceRate}%,${sla.breached} breaches of ${sla.total}`);
  lines.push("");
  lines.push("Leaderboard");
  lines.push(toCsv(["Rep", "Team", "Activities", "Deals won", "Revenue (QAR)", "Quota (QAR)"], board.map((r) => [r.name, r.team, r.activities, r.dealsWon, Math.round(r.revenue), Math.round(r.quota)])));

  return new NextResponse(lines.join("\r\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="report-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
