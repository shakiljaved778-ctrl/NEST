import { requireRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { KycConfig } from "@/components/admin/kyc-config";

export const metadata = { title: "Admin · KYC checklist" };
export const dynamic = "force-dynamic";

export default async function AdminKycPage() {
  await requireRole("ADMIN");
  const items = await db.kycChecklistItem.findMany({ orderBy: { sortOrder: "asc" } });
  return (
    <KycConfig
      items={items.map((i) => ({ id: i.id, name: i.name, appliesTo: i.appliesTo, required: i.required, sortOrder: i.sortOrder, active: i.active }))}
    />
  );
}
