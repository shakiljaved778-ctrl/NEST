import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { seesAll } from "@/lib/rbac";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TaskListClient } from "@/components/tasks/task-list";
import { NewTaskDialog } from "@/components/tasks/new-task-dialog";
import type { Prisma } from "@prisma/client";

export const metadata = { title: "Tasks" };
export const dynamic = "force-dynamic";

export default async function TasksPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const user = await requireUser();
  const sp = await searchParams;
  const filter = sp.filter ?? "open";

  // Reps/leads see their own tasks; managers/admin can see the whole team's.
  const ownerScope: Prisma.TaskWhereInput = seesAll(user.role)
    ? {}
    : user.role === "TEAM_LEAD" && user.teamId
      ? { owner: { teamId: user.teamId } }
      : { ownerId: user.id };

  const now = new Date();
  const statusWhere: Prisma.TaskWhereInput =
    filter === "done" ? { status: "DONE" } : filter === "overdue" ? { status: "OPEN", dueAt: { lt: now } } : { status: "OPEN" };

  const tasks = await db.task.findMany({
    where: { deletedAt: null, AND: [ownerScope, statusWhere] },
    include: {
      owner: { select: { name: true } },
      lead: { select: { id: true, firstName: true, lastName: true } },
      account: { select: { id: true, legalName: true } },
      contact: { select: { id: true, firstName: true, lastName: true } },
      deal: { select: { id: true, name: true } },
    },
    orderBy: { dueAt: "asc" },
    take: 200,
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Tasks</h1>
        <NewTaskDialog readOnly={user.role === "READ_ONLY"} />
      </div>

      <div className="flex gap-2">
        {[
          { key: "open", label: "Open" },
          { key: "overdue", label: "Overdue" },
          { key: "done", label: "Completed" },
        ].map((f) => (
          <Link
            key={f.key}
            href={`/tasks?filter=${f.key}`}
            className={`rounded-md border px-3 py-1.5 text-sm font-medium ${filter === f.key ? "bg-primary text-primary-foreground" : "bg-background hover:bg-accent"}`}
          >
            {f.label}
          </Link>
        ))}
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">
            {filter === "done" ? "Completed" : filter === "overdue" ? "Overdue" : "Open"} tasks ({tasks.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <TaskListClient
            tasks={tasks.map((t) => {
              const linked = t.lead
                ? { label: `${t.lead.firstName} ${t.lead.lastName}`, href: `/leads/${t.lead.id}` }
                : t.deal
                  ? { label: t.deal.name, href: `/deals/${t.deal.id}` }
                  : t.account
                    ? { label: t.account.legalName, href: `/clients/accounts/${t.account.id}` }
                    : t.contact
                      ? { label: `${t.contact.firstName} ${t.contact.lastName}`, href: `/clients/contacts/${t.contact.id}` }
                      : null;
              return {
                id: t.id,
                title: t.title,
                description: t.description,
                dueAt: t.dueAt.toISOString(),
                priority: t.priority,
                status: t.status,
                ownerName: t.owner.name,
                recurring: !!t.recurrence,
                linked,
              };
            })}
            readOnly={user.role === "READ_ONLY"}
          />
        </CardContent>
      </Card>
    </div>
  );
}
