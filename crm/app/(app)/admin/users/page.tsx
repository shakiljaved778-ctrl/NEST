import { requireRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { UsersManager } from "@/components/admin/users-manager";
import { titleCase, fmtMoney } from "@/lib/utils";

export const metadata = { title: "Admin · Users" };
export const dynamic = "force-dynamic";

export default async function AdminUsersPage() {
  await requireRole("ADMIN");
  const [users, teams] = await Promise.all([
    db.user.findMany({ where: { deletedAt: null }, include: { team: { select: { name: true } } }, orderBy: [{ active: "desc" }, { role: "asc" }, { name: "asc" }] }),
    db.team.findMany({ where: { deletedAt: null }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);

  const activeUsers = users.filter((u) => u.active);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{users.length} users · {activeUsers.length} active</p>
        <UsersManager
          mode="create"
          teams={teams}
          activeUsers={activeUsers.map((u) => ({ id: u.id, name: u.name }))}
        />
      </div>
      <div className="rounded-lg border bg-background">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Team</TableHead>
              <TableHead>Territory</TableHead>
              <TableHead className="text-end">Quota</TableHead>
              <TableHead>Status</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((u) => (
              <TableRow key={u.id}>
                <TableCell className="font-medium">{u.name}</TableCell>
                <TableCell className="text-muted-foreground">{u.email}</TableCell>
                <TableCell><Badge variant="outline">{titleCase(u.role)}</Badge></TableCell>
                <TableCell>{u.team?.name ?? "—"}</TableCell>
                <TableCell className="text-muted-foreground">{u.territory ?? "—"}</TableCell>
                <TableCell className="text-end">{u.quotaMonthly ? fmtMoney(u.quotaMonthly) : "—"}</TableCell>
                <TableCell>
                  {!u.active ? <Badge variant="secondary">Inactive</Badge> : u.onLeave ? <Badge variant="warning">On leave</Badge> : <Badge variant="success">Active</Badge>}
                  {u.totpEnabled && <Badge variant="info" className="ms-1">2FA</Badge>}
                </TableCell>
                <TableCell>
                  <UsersManager
                    mode="edit"
                    teams={teams}
                    activeUsers={activeUsers.filter((x) => x.id !== u.id).map((x) => ({ id: x.id, name: x.name }))}
                    user={{
                      id: u.id, name: u.name, email: u.email, role: u.role,
                      teamId: u.teamId, territory: u.territory, quotaMonthly: u.quotaMonthly,
                      active: u.active, onLeave: u.onLeave,
                    }}
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
