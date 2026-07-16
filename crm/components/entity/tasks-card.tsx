"use client";

import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { fmtDateTime } from "@/lib/utils";
import { completeTaskAction, reopenTaskAction } from "@/app/(app)/actions";

export type TaskItem = {
  id: string;
  title: string;
  dueAt: string;
  priority: string;
  status: string;
  ownerName: string;
};

const PRIORITY_VARIANT: Record<string, "secondary" | "info" | "warning" | "destructive"> = {
  LOW: "secondary",
  MEDIUM: "info",
  HIGH: "warning",
  URGENT: "destructive",
};

export function TasksCard({ tasks, path, readOnly }: { tasks: TaskItem[]; path: string; readOnly?: boolean }) {
  const router = useRouter();

  async function toggle(task: TaskItem, done: boolean) {
    const res = done ? await completeTaskAction(task.id, path) : await reopenTaskAction(task.id, path);
    if (!res.ok) toast.error(res.error);
    router.refresh();
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Tasks</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {tasks.length === 0 && <p className="text-sm text-muted-foreground">No tasks</p>}
        {tasks.map((t) => {
          const overdue = t.status === "OPEN" && new Date(t.dueAt) < new Date();
          return (
            <div key={t.id} className="flex items-start gap-2 text-sm">
              <Checkbox
                className="mt-0.5"
                checked={t.status === "DONE"}
                disabled={readOnly}
                onCheckedChange={(c) => toggle(t, c === true)}
                aria-label={`Complete ${t.title}`}
              />
              <div className="min-w-0 flex-1">
                <span className={t.status === "DONE" ? "text-muted-foreground line-through" : "font-medium"}>
                  {t.title}
                </span>
                <div className="text-xs text-muted-foreground">
                  <span className={overdue ? "font-medium text-destructive" : ""}>{fmtDateTime(t.dueAt)}</span>
                  {" · "}
                  {t.ownerName}
                </div>
              </div>
              <Badge variant={PRIORITY_VARIANT[t.priority] ?? "secondary"}>{t.priority.toLowerCase()}</Badge>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
