"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Phone, StickyNote, CheckSquare, Users, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { logActivityAction, createTaskAction } from "@/app/(app)/actions";

export type EntityLink = {
  leadId?: string;
  accountId?: string;
  contactId?: string;
  dealId?: string;
};

export function QuickActions({ link, path, readOnly }: { link: EntityLink; path: string; readOnly?: boolean }) {
  const router = useRouter();
  const [activityType, setActivityType] = useState<"CALL" | "NOTE" | "MEETING" | "EMAIL" | null>(null);
  const [taskOpen, setTaskOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  // activity form
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  // task form
  const [taskTitle, setTaskTitle] = useState("");
  const [taskDue, setTaskDue] = useState("");
  const [taskPriority, setTaskPriority] = useState("MEDIUM");
  const [recurrence, setRecurrence] = useState("none");

  if (readOnly) return null;

  async function submitActivity(e: React.FormEvent) {
    e.preventDefault();
    if (!activityType) return;
    setSaving(true);
    try {
      const res = await logActivityAction({ type: activityType, subject, body: body || null, ...link }, path);
      if (res.ok) {
        toast.success("Activity logged");
        setActivityType(null);
        setSubject("");
        setBody("");
        router.refresh();
      } else toast.error(res.error);
    } finally {
      setSaving(false);
    }
  }

  async function submitTask(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await createTaskAction(
        {
          title: taskTitle,
          dueAt: new Date(taskDue),
          priority: taskPriority,
          recurrence:
            recurrence === "none" ? null : { freq: recurrence as "DAILY" | "WEEKLY" | "MONTHLY", interval: 1 },
          ...link,
        },
        path
      );
      if (res.ok) {
        toast.success("Task created");
        setTaskOpen(false);
        setTaskTitle("");
        setTaskDue("");
        router.refresh();
      } else toast.error(res.error);
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" onClick={() => { setActivityType("CALL"); setSubject("Call"); }}>
          <Phone /> Log call
        </Button>
        <Button variant="outline" size="sm" onClick={() => { setActivityType("NOTE"); setSubject(""); }}>
          <StickyNote /> Add note
        </Button>
        <Button variant="outline" size="sm" onClick={() => { setActivityType("MEETING"); setSubject("Meeting"); }}>
          <Users /> Log meeting
        </Button>
        <Button variant="outline" size="sm" onClick={() => { setActivityType("EMAIL"); setSubject(""); }}>
          <Mail /> Log email
        </Button>
        <Button variant="outline" size="sm" onClick={() => setTaskOpen(true)}>
          <CheckSquare /> Create task
        </Button>
      </div>

      <Dialog open={activityType !== null} onOpenChange={(o) => !o && setActivityType(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Log {activityType?.toLowerCase()}</DialogTitle>
          </DialogHeader>
          <form onSubmit={submitActivity} className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor="qa-subject">Subject *</Label>
              <Input id="qa-subject" required value={subject} onChange={(e) => setSubject(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="qa-body">Details</Label>
              <Textarea id="qa-body" rows={4} value={body} onChange={(e) => setBody(e.target.value)} />
            </div>
            <DialogFooter>
              <Button type="submit" disabled={saving}>Save</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={taskOpen} onOpenChange={setTaskOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New task</DialogTitle>
          </DialogHeader>
          <form onSubmit={submitTask} className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor="qa-task-title">Title *</Label>
              <Input id="qa-task-title" required value={taskTitle} onChange={(e) => setTaskTitle(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="qa-task-due">Due *</Label>
                <Input id="qa-task-due" type="datetime-local" required value={taskDue} onChange={(e) => setTaskDue(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label>Priority</Label>
                <Select value={taskPriority} onValueChange={setTaskPriority}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {["LOW", "MEDIUM", "HIGH", "URGENT"].map((p) => (
                      <SelectItem key={p} value={p}>{p.charAt(0) + p.slice(1).toLowerCase()}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1">
              <Label>Repeat</Label>
              <Select value={recurrence} onValueChange={setRecurrence}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Does not repeat</SelectItem>
                  <SelectItem value="DAILY">Daily</SelectItem>
                  <SelectItem value="WEEKLY">Weekly</SelectItem>
                  <SelectItem value="MONTHLY">Monthly</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <DialogFooter>
              <Button type="submit" disabled={saving}>Create task</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
