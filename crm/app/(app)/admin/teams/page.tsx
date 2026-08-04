import { requireRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { TeamsManager } from "@/components/admin/teams-manager";

export const metadata = { title: "Admin · Teams" };
export const dynamic = "force-dynamic";

export default async function AdminTeamsPage() {
  await requireRole("ADMIN");
  const [teams, leads] = await Promise.all([
    db.team.findMany({
      where: { deletedAt: null },
      include: { teamLead: { select: { name: true } }, _count: { select: { members: true } } },
      orderBy: { name: "asc" },
    }),
    db.user.findMany({
      where: { active: true, deletedAt: null, role: { in: ["TEAM_LEAD", "MANAGER"] } },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{teams.length} teams</p>
        <TeamsManager mode="create" leads={leads} />
      </div>
      <div className="rounded-lg border bg-background">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Team</TableHead>
              <TableHead>Team lead</TableHead>
              <TableHead>Territory</TableHead>
              <TableHead>Product line</TableHead>
              <TableHead className="text-end">Members</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {teams.map((t) => (
              <TableRow key={t.id}>
                <TableCell className="font-medium">{t.name}</TableCell>
                <TableCell>{t.teamLead?.name ?? "—"}</TableCell>
                <TableCell className="text-muted-foreground">{t.territory ?? "—"}</TableCell>
                <TableCell className="text-muted-foreground">{t.productLine ?? "—"}</TableCell>
                <TableCell className="text-end">{t._count.members}</TableCell>
                <TableCell>
                  <TeamsManager
                    mode="edit"
                    leads={leads}
                    team={{ id: t.id, name: t.name, territory: t.territory, productLine: t.productLine, teamLeadId: t.teamLeadId }}
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
