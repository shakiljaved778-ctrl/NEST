"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Repeat, Trash2 } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { fmtDateTime } from "@/lib/utils";
import { completeTaskAction, reopenTaskAction, deleteTaskAction } from "@/app/(app)/actions";

export type TaskListItem = {
  id: string;
  title: string;
  description: string | null;
  dueAt: string;
  priority: string;
  status: string;
  ownerName: string;
  recurring: boolean;
  linked: { label: string; href: string } | null;
};

const PRIORITY_VARIANT: Record<string, "secondary" | "info" | "warning" | "destructive"> = {
  LOW: "secondary",
  MEDIUM: "info",
  HIGH: "warning",
  URGENT: "destructive",
};

export function TaskListClient({ tasks, readOnly }: { tasks: TaskListItem[]; readOnly?: boolean }) {
  const router = useRouter();

  async function toggle(id: string, done: boolean) {
    const res = done ? await completeTaskAction(id, "/tasks") : await reopenTaskAction(id, "/tasks");
    if (res.ok) {
      toast.success(done ? "Task completed" : "Task reopened");
      router.refresh();
    } else toast.error(res.error);
  }

  async function remove(id: string) {
    if (!window.confirm("Delete this task?")) return;
    const res = await deleteTaskAction(id, "/tasks");
    if (res.ok) {
      toast.success("Task deleted");
      router.refresh();
    } else toast.error(res.error);
  }

  if (tasks.length === 0) return <p className="py-6 text-center text-sm text-muted-foreground">No tasks</p>;

  return (
    <div className="divide-y">
      {tasks.map((t) => {
        const overdue = t.status === "OPEN" && new Date(t.dueAt) < new Date();
        return (
          <div key={t.id} className="flex items-start gap-3 py-2 text-sm">
            <Checkbox
              className="mt-0.5"
              checked={t.status === "DONE"}
              disabled={readOnly}
              onCheckedChange={(c) => toggle(t.id, c === true)}
              aria-label={`Complete ${t.title}`}
            />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className={t.status === "DONE" ? "text-muted-foreground line-through" : "font-medium"}>{t.title}</span>
                {t.recurring && <Repeat className="h-3 w-3 text-muted-foreground" />}
              </div>
              {t.description && <p className="text-xs text-muted-foreground">{t.description}</p>}
              <div className="text-xs text-muted-foreground">
                <span className={overdue ? "font-medium text-destructive" : ""}>{fmtDateTime(t.dueAt)}</span>
                {" · "}
                {t.ownerName}
                {t.linked && (
                  <>
                    {" · "}
                    <Link href={t.linked.href} className="text-primary hover:underline">
                      {t.linked.label}
                    </Link>
                  </>
                )}
              </div>
            </div>
            <Badge variant={PRIORITY_VARIANT[t.priority] ?? "secondary"}>{t.priority.toLowerCase()}</Badge>
            {!readOnly && (
              <button onClick={() => remove(t.id)} aria-label="Delete task">
                <Trash2 className="h-4 w-4 text-muted-foreground hover:text-destructive" />
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}
