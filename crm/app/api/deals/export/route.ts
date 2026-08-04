import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { dealScope } from "@/lib/rbac";
import { buildDealWhere, type DealFilters } from "@/lib/services/deals";
import { logAudit } from "@/lib/audit";
import { toCsv } from "@/lib/utils";

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = session.user;

  const sp = new URL(req.url).searchParams;
  const filters: DealFilters = {
    q: sp.get("q") ?? undefined,
    pipelineId: sp.get("pipelineId") ?? undefined,
    status: sp.get("status") ?? undefined,
    ownerId: sp.get("ownerId") ?? undefined,
  };

  const scope = await dealScope(user);
  const deals = await db.deal.findMany({
    where: { AND: [buildDealWhere(filters), scope] },
    include: {
      stage: { select: { name: true } },
      owner: { select: { name: true } },
      account: { select: { legalName: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 10_000,
  });

  await logAudit({
    action: "EXPORT", entityType: "DEAL", actorId: user.id, actorEmail: user.email,
    after: { count: deals.length },
  });

  const csv = toCsv(
    ["Deal", "Account", "Stage", "Status", "Value", "Currency", "Value (QAR)", "Owner", "Expected close", "Won at", "Lost at", "Loss reason", "Created (UTC)"],
    deals.map((d) => [
      d.name, d.account?.legalName, d.stage.name, d.status, d.value, d.currency,
      Math.round(d.value * d.fxRateToQar), d.owner?.name,
      d.expectedCloseAt?.toISOString().slice(0, 10) ?? "", d.wonAt?.toISOString().slice(0, 10) ?? "",
      d.lostAt?.toISOString().slice(0, 10) ?? "", d.lossReason, d.createdAt.toISOString(),
    ])
  );

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="deals-export-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
