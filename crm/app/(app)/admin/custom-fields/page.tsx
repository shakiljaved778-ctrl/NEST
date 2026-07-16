import { requireRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { CustomFieldsManager } from "@/components/admin/custom-fields-manager";

export const metadata = { title: "Admin · Custom fields" };
export const dynamic = "force-dynamic";

export default async function AdminCustomFieldsPage() {
  await requireRole("ADMIN");
  const fields = await db.customFieldDefinition.findMany({ orderBy: [{ entity: "asc" }, { sortOrder: "asc" }] });
  return (
    <CustomFieldsManager
      fields={fields.map((f) => ({
        id: f.id, entity: f.entity, key: f.key, label: f.label, type: f.type,
        options: (f.options as string[]) ?? [], required: f.required,
      }))}
    />
  );
}
