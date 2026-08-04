import { requireRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { PipelineEditor } from "@/components/admin/pipeline-editor";

export const metadata = { title: "Admin · Pipelines" };
export const dynamic = "force-dynamic";

export default async function AdminPipelinesPage() {
  await requireRole("ADMIN");
  const pipelines = await db.pipeline.findMany({
    where: { deletedAt: null },
    include: {
      stages: { where: { deletedAt: null }, orderBy: { sortOrder: "asc" }, include: { _count: { select: { deals: true } } } },
      _count: { select: { deals: true } },
    },
    orderBy: [{ isDefault: "desc" }, { name: "asc" }],
  });

  return (
    <PipelineEditor
      pipelines={pipelines.map((p) => ({
        id: p.id,
        name: p.name,
        isDefault: p.isDefault,
        stages: p.stages.map((s) => ({ id: s.id, name: s.name, probability: s.probability, type: s.type, sortOrder: s.sortOrder, dealCount: s._count.deals })),
      }))}
    />
  );
}
