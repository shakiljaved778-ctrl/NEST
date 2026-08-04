import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { leadScope } from "@/lib/rbac";
import { buildLeadWhere, type LeadFilters } from "@/lib/services/leads";
import { logAudit } from "@/lib/audit";
import { toCsv } from "@/lib/utils";

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = session.user;

  const sp = new URL(req.url).searchParams;
  const filters: LeadFilters = {
    q: sp.get("q") ?? undefined,
    status: sp.get("status") ?? undefined,
    source: sp.get("source") ?? undefined,
    ownerId: sp.get("ownerId") ?? undefined,
    territory: sp.get("territory") ?? undefined,
    dateFrom: sp.get("dateFrom") ?? undefined,
    dateTo: sp.get("dateTo") ?? undefined,
  };

  const scope = await leadScope(user);
  const leads = await db.lead.findMany({
    where: { AND: [buildLeadWhere(filters), scope] },
    include: { owner: { select: { name: true } }, productInterest: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
    take: 10_000,
  });

  await logAudit({
    action: "EXPORT", entityType: "LEAD", actorId: user.id, actorEmail: user.email,
    after: { count: leads.length, filters: filters as never },
  });

  const csv = toCsv(
    ["First name", "Last name", "Company", "Email", "Phone", "Status", "Source", "Channel", "Campaign", "Territory", "Score", "Owner", "Product interest", "Created (UTC)", "First touch (UTC)", "SLA breached"],
    leads.map((l) => [
      l.firstName, l.lastName, l.company, l.email, l.phone, l.status, l.source, l.channel, l.campaign,
      l.territory, l.score, l.owner?.name, l.productInterest?.name,
      l.createdAt.toISOString(), l.firstTouchAt?.toISOString() ?? "", l.slaBreachedAt ? "yes" : "no",
    ])
  );

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="leads-export-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
