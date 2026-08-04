import Link from "next/link";
import { Sun, Clock, AlertTriangle, CalendarClock, CheckSquare } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { leadScope } from "@/lib/rbac";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TasksCard } from "@/components/entity/tasks-card";
import { fmtDate, fmtMoney, relativeTime } from "@/lib/utils";

export const metadata = { title: "My Day" };
export const dynamic = "force-dynamic";

export default async function MyDayPage() {
  const user = await requireUser();
  const now = new Date();
  const endOfDay = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 23, 59, 59));
  const scope = await leadScope(user);

  const [todayTasks, overdueTasks, newLeads, renewals] = await Promise.all([
    db.task.findMany({
      where: { ownerId: user.id, status: "OPEN", deletedAt: null, dueAt: { gte: now, lte: endOfDay } },
      include: { owner: { select: { name: true } } },
      orderBy: { dueAt: "asc" },
    }),
    db.task.findMany({
      where: { ownerId: user.id, status: "OPEN", deletedAt: null, dueAt: { lt: now } },
      include: { owner: { select: { name: true } } },
      orderBy: { dueAt: "asc" },
      take: 25,
    }),
    db.lead.findMany({
      where: { AND: [{ status: "NEW", firstTouchAt: null, deletedAt: null }, scope] },
      orderBy: { slaDueAt: "asc" },
      take: 25,
      include: { productInterest: { select: { name: true } } },
    }),
    db.subscription.findMany({
      where: {
        deletedAt: null,
        status: "ACTIVE",
        renewalDate: { gte: now, lte: new Date(now.getTime() + 60 * 86_400_000) },
        OR: [{ account: { ownerId: user.id } }, { contact: { ownerId: user.id } }],
      },
      include: {
        product: { select: { name: true } },
        account: { select: { id: true, legalName: true } },
        contact: { select: { id: true, firstName: true, lastName: true } },
      },
      orderBy: { renewalDate: "asc" },
      take: 25,
    }),
  ]);

  const stats = [
    { label: "New leads (first touch)", value: newLeads.length, icon: Clock, tone: "text-sky-600" },
    { label: "Tasks due today", value: todayTasks.length, icon: CheckSquare, tone: "text-emerald-600" },
    { label: "Overdue tasks", value: overdueTasks.length, icon: AlertTriangle, tone: "text-destructive" },
    { label: "Upcoming renewals", value: renewals.length, icon: CalendarClock, tone: "text-amber-600" },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Sun className="h-6 w-6 text-amber-500" />
        <h1 className="text-2xl font-semibold">My Day</h1>
        <span className="text-muted-foreground">· {user.name}</span>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((s) => (
          <Card key={s.label}>
            <CardContent className="flex items-center gap-3 p-4">
              <s.icon className={`h-8 w-8 ${s.tone}`} />
              <div>
                <p className="text-2xl font-semibold">{s.value}</p>
                <p className="text-xs text-muted-foreground">{s.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Clock className="h-4 w-4" /> New leads awaiting first touch
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {newLeads.length === 0 && <p className="text-sm text-muted-foreground">All caught up 🎉</p>}
            {newLeads.map((lead) => {
              const breached = lead.slaDueAt && lead.slaDueAt < now;
              return (
                <div key={lead.id} className="flex items-center justify-between text-sm">
                  <Link href={`/leads/${lead.id}`} className="font-medium text-primary hover:underline">
                    {lead.firstName} {lead.lastName}
                    {lead.company ? <span className="text-muted-foreground"> · {lead.company}</span> : ""}
                  </Link>
                  {lead.slaDueAt &&
                    (breached ? (
                      <Badge variant="destructive">SLA breached</Badge>
                    ) : (
                      <span className="text-xs text-amber-600">due {relativeTime(lead.slaDueAt)}</span>
                    ))}
                </div>
              );
            })}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <CalendarClock className="h-4 w-4" /> Upcoming renewals
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {renewals.length === 0 && <p className="text-sm text-muted-foreground">No renewals in the next 60 days</p>}
            {renewals.map((sub) => {
              const clientName = sub.account?.legalName ?? `${sub.contact?.firstName} ${sub.contact?.lastName}`;
              const href = sub.account ? `/clients/accounts/${sub.account.id}` : `/clients/contacts/${sub.contact?.id}`;
              return (
                <div key={sub.id} className="flex items-center justify-between text-sm">
                  <div>
                    <Link href={href} className="font-medium text-primary hover:underline">{clientName}</Link>
                    <span className="text-xs text-muted-foreground"> · {sub.product.name}</span>
                  </div>
                  <span className="text-xs text-amber-600">
                    {sub.renewalDate ? `${fmtDate(sub.renewalDate)} (${relativeTime(sub.renewalDate)})` : ""} · {fmtMoney(sub.mrrValue)}/mo
                  </span>
                </div>
              );
            })}
          </CardContent>
        </Card>

        {overdueTasks.length > 0 && (
          <TasksCard
            tasks={overdueTasks.map((t) => ({
              id: t.id, title: t.title, dueAt: t.dueAt.toISOString(), priority: t.priority, status: t.status, ownerName: t.owner.name,
            }))}
            path="/my-day"
            readOnly={user.role === "READ_ONLY"}
          />
        )}
        <TasksCard
          tasks={todayTasks.map((t) => ({
            id: t.id, title: t.title, dueAt: t.dueAt.toISOString(), priority: t.priority, status: t.status, ownerName: t.owner.name,
          }))}
          path="/my-day"
          readOnly={user.role === "READ_ONLY"}
        />
      </div>
    </div>
  );
}
