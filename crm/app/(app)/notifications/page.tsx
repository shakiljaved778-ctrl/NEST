import Link from "next/link";
import { Bell, CheckCheck } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MarkAllReadButton } from "@/components/notifications/mark-read";
import { relativeTime } from "@/lib/utils";
import { cn } from "@/lib/utils";

export const metadata = { title: "Notifications" };
export const dynamic = "force-dynamic";

const TYPE_TONE: Record<string, string> = {
  sla_breach: "border-l-destructive",
  sla_escalation: "border-l-destructive",
  lead_assigned: "border-l-sky-500",
  renewal: "border-l-amber-500",
  task_due: "border-l-emerald-500",
};

export default async function NotificationsPage() {
  const user = await requireUser();
  const notifications = await db.notification.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  const unread = notifications.filter((n) => !n.readAt).length;

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="flex items-center gap-2 text-2xl font-semibold">
          <Bell className="h-6 w-6" /> Notifications
          {unread > 0 && <span className="text-base font-normal text-muted-foreground">({unread} unread)</span>}
        </h1>
        {unread > 0 && <MarkAllReadButton />}
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Recent</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {notifications.length === 0 && (
            <p className="py-6 text-center text-sm text-muted-foreground">
              <CheckCheck className="mx-auto mb-2 h-6 w-6" />
              You&apos;re all caught up
            </p>
          )}
          {notifications.map((n) => {
            const body = (
              <div
                className={cn(
                  "border-l-2 ps-3",
                  TYPE_TONE[n.type] ?? "border-l-muted",
                  !n.readAt && "bg-muted/40"
                )}
              >
                <div className="flex items-baseline justify-between gap-2">
                  <span className={cn("text-sm", !n.readAt && "font-medium")}>{n.title}</span>
                  <span className="whitespace-nowrap text-xs text-muted-foreground">{relativeTime(n.createdAt)}</span>
                </div>
                {n.body && <p className="text-xs text-muted-foreground">{n.body}</p>}
              </div>
            );
            return n.link ? (
              <Link key={n.id} href={n.link} className="block rounded p-1 hover:bg-accent/50">
                {body}
              </Link>
            ) : (
              <div key={n.id} className="p-1">
                {body}
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}
