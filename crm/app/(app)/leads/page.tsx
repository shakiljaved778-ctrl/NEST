import Link from "next/link";
import { Upload } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { listLeads, type LeadFilters } from "@/lib/services/leads";
import { isManagerial } from "@/lib/rbac";
import { Button } from "@/components/ui/button";
import { LeadFiltersBar } from "@/components/leads/lead-filters";
import { LeadTable } from "@/components/leads/lead-table";
import { NewLeadDialog } from "@/components/leads/new-lead-dialog";
import { Pagination } from "@/components/pagination";
import { ExportButton } from "@/components/export-button";

export const metadata = { title: "Leads" };
export const dynamic = "force-dynamic";

export default async function LeadsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const user = await requireUser();
  const sp = await searchParams;
  const filters: LeadFilters = {
    q: sp.q,
    status: sp.status,
    source: sp.source,
    ownerId: sp.ownerId,
    territory: sp.territory,
    campaign: sp.campaign,
    minScore: sp.minScore ? Number(sp.minScore) : undefined,
    dateFrom: sp.dateFrom,
    dateTo: sp.dateTo,
    sort: sp.sort,
    dir: sp.dir === "asc" ? "asc" : sp.dir === "desc" ? "desc" : undefined,
    page: sp.page ? Number(sp.page) : 1,
  };

  const [{ leads, total, page, pages }, owners, products, savedViews] = await Promise.all([
    listLeads(user, filters),
    db.user.findMany({
      where: { active: true, deletedAt: null, role: { in: ["REP", "TEAM_LEAD", "MANAGER"] } },
      select: { id: true, name: true, teamId: true },
      orderBy: { name: "asc" },
    }),
    db.product.findMany({ where: { active: true, deletedAt: null }, select: { id: true, name: true } }),
    db.savedView.findMany({
      where: { entity: "lead", OR: [{ userId: user.id }, { shared: true }] },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const canBulkAssign = isManagerial(user.role) || user.role === "TEAM_LEAD";

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-semibold">Leads</h1>
        <div className="flex gap-2">
          <ExportButton href={`/api/leads/export?${new URLSearchParams(sp as Record<string, string>).toString()}`} />
          <Button variant="outline" asChild>
            <Link href="/leads/import">
              <Upload /> Import CSV
            </Link>
          </Button>
          <NewLeadDialog products={products} />
        </div>
      </div>

      <LeadFiltersBar
        owners={owners}
        savedViews={savedViews.map((v) => ({
          id: v.id,
          name: v.name,
          filters: v.filters as Record<string, string>,
          own: v.userId === user.id,
        }))}
      />

      <LeadTable
        leads={leads.map((l) => ({
          id: l.id,
          name: `${l.firstName} ${l.lastName}`,
          company: l.company,
          email: l.email,
          phone: l.phone,
          status: l.status,
          source: l.source,
          score: l.score,
          territory: l.territory,
          owner: l.owner?.name ?? null,
          product: l.productInterest?.name ?? null,
          createdAt: l.createdAt.toISOString(),
          slaDueAt: l.slaDueAt?.toISOString() ?? null,
          firstTouchAt: l.firstTouchAt?.toISOString() ?? null,
          slaBreachedAt: l.slaBreachedAt?.toISOString() ?? null,
        }))}
        owners={owners}
        canBulkAssign={canBulkAssign}
        readOnly={user.role === "READ_ONLY"}
      />

      <Pagination page={page} pages={pages} total={total} />
    </div>
  );
}
