import { requireRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { RestoreButton } from "@/components/admin/restore-button";
import { fmtDateTime } from "@/lib/utils";

export const metadata = { title: "Admin · Recycle bin" };
export const dynamic = "force-dynamic";

export default async function RecycleBinPage() {
  await requireRole("ADMIN");
  const [leads, accounts, contacts, deals, tasks, documents] = await Promise.all([
    db.lead.findMany({ where: { deletedAt: { not: null } }, orderBy: { deletedAt: "desc" }, take: 100 }),
    db.account.findMany({ where: { deletedAt: { not: null } }, orderBy: { deletedAt: "desc" }, take: 100 }),
    db.contact.findMany({ where: { deletedAt: { not: null } }, orderBy: { deletedAt: "desc" }, take: 100 }),
    db.deal.findMany({ where: { deletedAt: { not: null } }, orderBy: { deletedAt: "desc" }, take: 100 }),
    db.task.findMany({ where: { deletedAt: { not: null } }, orderBy: { deletedAt: "desc" }, take: 100 }),
    db.document.findMany({ where: { deletedAt: { not: null } }, orderBy: { deletedAt: "desc" }, take: 100 }),
  ]);

  const rows = [
    ...leads.map((l) => ({ entity: "LEAD", id: l.id, label: `${l.firstName} ${l.lastName}`, deletedAt: l.deletedAt! })),
    ...accounts.map((a) => ({ entity: "ACCOUNT", id: a.id, label: a.legalName, deletedAt: a.deletedAt! })),
    ...contacts.map((c) => ({ entity: "CONTACT", id: c.id, label: `${c.firstName} ${c.lastName}`, deletedAt: c.deletedAt! })),
    ...deals.map((d) => ({ entity: "DEAL", id: d.id, label: d.name, deletedAt: d.deletedAt! })),
    ...tasks.map((t) => ({ entity: "TASK", id: t.id, label: t.title, deletedAt: t.deletedAt! })),
    ...documents.map((d) => ({ entity: "DOCUMENT", id: d.id, label: d.name, deletedAt: d.deletedAt! })),
  ].sort((a, b) => b.deletedAt.getTime() - a.deletedAt.getTime());

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">Soft-deleted records. Restore returns them to normal use.</p>
      <div className="rounded-lg border bg-background">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Type</TableHead>
              <TableHead>Record</TableHead>
              <TableHead>Deleted</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 && (
              <TableRow><TableCell colSpan={4} className="py-8 text-center text-muted-foreground">Recycle bin is empty</TableCell></TableRow>
            )}
            {rows.map((r) => (
              <TableRow key={`${r.entity}-${r.id}`}>
                <TableCell><Badge variant="outline">{r.entity}</Badge></TableCell>
                <TableCell className="font-medium">{r.label}</TableCell>
                <TableCell className="text-xs text-muted-foreground">{fmtDateTime(r.deletedAt)}</TableCell>
                <TableCell><RestoreButton entity={r.entity} id={r.id} /></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
