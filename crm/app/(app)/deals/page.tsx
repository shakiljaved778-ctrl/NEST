import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { kanbanDeals, listDeals, type DealFilters } from "@/lib/services/deals";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { KanbanBoard } from "@/components/deals/kanban";
import { DealTable } from "@/components/deals/deal-table";
import { NewDealDialog } from "@/components/deals/new-deal-dialog";
import { Pagination } from "@/components/pagination";
import { ExportButton } from "@/components/export-button";
import { DealFiltersBar } from "@/components/deals/deal-filters";

export const metadata = { title: "Deals" };
export const dynamic = "force-dynamic";

export default async function DealsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const user = await requireUser();
  const sp = await searchParams;

  const pipelines = await db.pipeline.findMany({
    where: { deletedAt: null },
    include: { stages: { where: { deletedAt: null }, orderBy: { sortOrder: "asc" } } },
    orderBy: [{ isDefault: "desc" }, { name: "asc" }],
  });
  const pipeline = pipelines.find((p) => p.id === sp.pipelineId) ?? pipelines[0];
  if (!pipeline) {
    return <p className="text-muted-foreground">No pipeline configured. Ask an admin to create one.</p>;
  }

  const filters: DealFilters = {
    q: sp.q,
    ownerId: sp.ownerId,
    status: sp.status,
    page: sp.page ? Number(sp.page) : 1,
  };

  const view = sp.view === "table" ? "table" : "board";

  const [boardDeals, tableData, owners, accounts, contacts, products] = await Promise.all([
    view === "board" ? kanbanDeals(user, pipeline.id, filters) : Promise.resolve([]),
    view === "table" ? listDeals(user, { ...filters, pipelineId: pipeline.id }) : Promise.resolve(null),
    db.user.findMany({
      where: { active: true, deletedAt: null, role: { in: ["REP", "TEAM_LEAD", "MANAGER"] } },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    db.account.findMany({ where: { deletedAt: null }, select: { id: true, legalName: true }, orderBy: { legalName: "asc" }, take: 300 }),
    db.contact.findMany({ where: { deletedAt: null }, select: { id: true, firstName: true, lastName: true }, orderBy: { firstName: "asc" }, take: 300 }),
    db.product.findMany({ where: { active: true, deletedAt: null }, orderBy: { name: "asc" } }),
  ]);

  const serialize = (d: (typeof boardDeals)[number]) => ({
    id: d.id,
    name: d.name,
    value: d.value,
    currency: d.currency,
    stageId: d.stageId,
    stageName: d.stage.name,
    status: d.status,
    owner: d.owner?.name ?? null,
    account: d.account?.legalName ?? null,
    expectedCloseAt: d.expectedCloseAt?.toISOString() ?? null,
    updatedAt: d.updatedAt.toISOString(),
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-semibold">Deals</h1>
        <div className="flex gap-2">
          <ExportButton href={`/api/deals/export?pipelineId=${pipeline.id}`} />
          <NewDealDialog
            pipelines={pipelines.map((p) => ({
              id: p.id,
              name: p.name,
              stages: p.stages.map((s) => ({ id: s.id, name: s.name })),
            }))}
            accounts={accounts}
            contacts={contacts.map((c) => ({ id: c.id, name: `${c.firstName} ${c.lastName}` }))}
            products={products.map((p) => ({ id: p.id, name: p.name, price: p.price }))}
            owners={owners}
          />
        </div>
      </div>

      <DealFiltersBar pipelines={pipelines.map((p) => ({ id: p.id, name: p.name }))} owners={owners} currentPipelineId={pipeline.id} />

      <Tabs value={view}>
        <TabsList>
          <TabsTrigger value="board" asChild>
            <a href={`?${new URLSearchParams({ ...(sp as Record<string, string>), view: "board" }).toString()}`}>Board</a>
          </TabsTrigger>
          <TabsTrigger value="table" asChild>
            <a href={`?${new URLSearchParams({ ...(sp as Record<string, string>), view: "table" }).toString()}`}>Table</a>
          </TabsTrigger>
        </TabsList>
        <TabsContent value="board">
          <KanbanBoard
            stages={pipeline.stages.map((s) => ({ id: s.id, name: s.name, probability: s.probability, type: s.type }))}
            deals={boardDeals.map(serialize)}
            readOnly={user.role === "READ_ONLY"}
            products={products.map((p) => ({ id: p.id, name: p.name, price: p.price, pricingModel: p.pricingModel }))}
          />
        </TabsContent>
        <TabsContent value="table">
          {tableData && (
            <>
              <DealTable deals={tableData.deals.map(serialize)} />
              <Pagination page={tableData.page} pages={tableData.pages} total={tableData.total} />
            </>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
