import { requireRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { Prisma } from "@prisma/client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { AuditFilters } from "@/components/admin/audit-filters";
import { Pagination } from "@/components/pagination";
import { fmtDateTime } from "@/lib/utils";

export const metadata = { title: "Admin · Audit log" };
export const dynamic = "force-dynamic";

const ACTION_VARIANT: Record<string, "success" | "info" | "warning" | "destructive" | "secondary" | "purple"> = {
  CREATE: "success", UPDATE: "info", DELETE: "destructive", RESTORE: "success",
  VIEW: "secondary", DOWNLOAD: "secondary", REVEAL: "warning", LOGIN: "secondary",
  LOGIN_FAILED: "warning", LOCKOUT: "destructive", EXPORT: "purple", ERASE: "destructive",
  ASSIGN: "info", CONVERT: "success", MERGE: "info", STAGE_CHANGE: "info", SLA_BREACH: "destructive",
};

export default async function AdminAuditPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  await requireRole("ADMIN");
  const sp = await searchParams;
  const page = Math.max(sp.page ? Number(sp.page) : 1, 1);
  const pageSize = 50;

  const where: Prisma.AuditLogWhereInput = {};
  if (sp.action) where.action = sp.action as Prisma.AuditLogWhereInput["action"];
  if (sp.entityType) where.entityType = sp.entityType as Prisma.AuditLogWhereInput["entityType"];
  if (sp.actor) where.actorEmail = { contains: sp.actor, mode: "insensitive" };
  if (sp.entityId) where.entityId = sp.entityId;
  if (sp.dateFrom || sp.dateTo) {
    where.createdAt = {
      ...(sp.dateFrom ? { gte: new Date(sp.dateFrom) } : {}),
      ...(sp.dateTo ? { lte: new Date(sp.dateTo + "T23:59:59Z") } : {}),
    };
  }

  const [total, logs] = await Promise.all([
    db.auditLog.count({ where }),
    db.auditLog.findMany({ where, orderBy: { createdAt: "desc" }, skip: (page - 1) * pageSize, take: pageSize }),
  ]);

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Append-only audit trail. {total.toLocaleString()} entries. Every create/update/delete, sensitive-record view,
        reveal, export and login is recorded.
      </p>
      <AuditFilters />
      <div className="rounded-lg border bg-background">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Time (Qatar)</TableHead>
              <TableHead>Actor</TableHead>
              <TableHead>Action</TableHead>
              <TableHead>Entity</TableHead>
              <TableHead>Details</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {logs.length === 0 && (
              <TableRow><TableCell colSpan={5} className="py-8 text-center text-muted-foreground">No audit entries match</TableCell></TableRow>
            )}
            {logs.map((log) => {
              const diff = log.after ? JSON.stringify(log.after) : "";
              return (
                <TableRow key={log.id}>
                  <TableCell className="whitespace-nowrap text-xs text-muted-foreground">{fmtDateTime(log.createdAt)}</TableCell>
                  <TableCell className="text-xs">{log.actorEmail ?? "system"}</TableCell>
                  <TableCell><Badge variant={ACTION_VARIANT[log.action] ?? "secondary"}>{log.action}</Badge></TableCell>
                  <TableCell className="text-xs">
                    <span className="font-medium">{log.entityType}</span>
                    {log.entityLabel && <span className="text-muted-foreground"> · {log.entityLabel}</span>}
                  </TableCell>
                  <TableCell className="max-w-md truncate font-mono text-xs text-muted-foreground" title={diff}>{diff}</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
      <Pagination page={page} pages={Math.max(Math.ceil(total / pageSize), 1)} total={total} />
    </div>
  );
}
