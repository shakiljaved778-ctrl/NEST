"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { createUserAction, updateUserAction, deactivateUserAction } from "@/app/(app)/admin/actions";

const ROLES = ["ADMIN", "MANAGER", "TEAM_LEAD", "REP", "READ_ONLY"];
const TERRITORIES = ["Doha North", "Doha South", "Al Rayyan", "Al Wakrah"];

type EditUser = {
  id: string; name: string; email: string; role: string;
  teamId: string | null; territory: string | null; quotaMonthly: number; active: boolean; onLeave: boolean;
};

export function UsersManager({
  mode,
  teams,
  activeUsers,
  user,
}: {
  mode: "create" | "edit";
  teams: { id: string; name: string }[];
  activeUsers: { id: string; name: string }[];
  user?: EditUser;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [reassignTo, setReassignTo] = useState("");
  const [form, setForm] = useState({
    name: user?.name ?? "",
    email: user?.email ?? "",
    role: user?.role ?? "REP",
    teamId: user?.teamId ?? "",
    territory: user?.territory ?? "",
    quotaMonthly: String(user?.quotaMonthly ?? 0),
    password: "",
    onLeave: user?.onLeave ?? false,
  });

  function set<K extends keyof typeof form>(k: K, v: (typeof form)[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      if (mode === "create") {
        const res = await createUserAction({
          email: form.email, name: form.name, role: form.role,
          teamId: form.teamId || null, territory: form.territory || null,
          quotaMonthly: Number(form.quotaMonthly) || 0, password: form.password,
        });
        if (res.ok) { toast.success("User created"); setOpen(false); router.refresh(); }
        else toast.error(res.error);
      } else if (user) {
        const data: Record<string, unknown> = {
          name: form.name, role: form.role, teamId: form.teamId || null,
          territory: form.territory || null, quotaMonthly: Number(form.quotaMonthly) || 0, onLeave: form.onLeave,
        };
        if (form.password) data.password = form.password;
        const res = await updateUserAction(user.id, data);
        if (res.ok) { toast.success("User updated"); setOpen(false); router.refresh(); }
        else toast.error(res.error);
      }
    } finally {
      setSaving(false);
    }
  }

  async function deactivate() {
    if (!user) return;
    if (!window.confirm(`Deactivate ${user.name}?${reassignTo ? " Their open records will be reassigned." : ""}`)) return;
    setSaving(true);
    try {
      const res = await deactivateUserAction(user.id, reassignTo || undefined);
      if (res.ok) { toast.success(`Deactivated${res.id !== "0" ? ` · ${res.id} records reassigned` : ""}`); setOpen(false); router.refresh(); }
      else toast.error(res.error);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {mode === "create" ? (
          <Button><Plus /> New user</Button>
        ) : (
          <Button variant="ghost" size="icon" aria-label="Edit user"><Pencil className="h-4 w-4" /></Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{mode === "create" ? "New user" : `Edit ${user?.name}`}</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label htmlFor="u-name">Name *</Label>
            <Input id="u-name" required value={form.name} onChange={(e) => set("name", e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="u-email">Email *</Label>
            <Input id="u-email" type="email" required disabled={mode === "edit"} value={form.email} onChange={(e) => set("email", e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Role</Label>
            <Select value={form.role} onValueChange={(v) => set("role", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {ROLES.map((r) => <SelectItem key={r} value={r}>{r.replace("_", " ")}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Team</Label>
            <Select value={form.teamId || "none"} onValueChange={(v) => set("teamId", v === "none" ? "" : v)}>
              <SelectTrigger><SelectValue placeholder="No team" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No team</SelectItem>
                {teams.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Territory</Label>
            <Select value={form.territory || "none"} onValueChange={(v) => set("territory", v === "none" ? "" : v)}>
              <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">—</SelectItem>
                {TERRITORIES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="u-quota">Monthly quota (QAR)</Label>
            <Input id="u-quota" type="number" min={0} value={form.quotaMonthly} onChange={(e) => set("quotaMonthly", e.target.value)} />
          </div>
          <div className="col-span-2 space-y-1">
            <Label htmlFor="u-pw">{mode === "create" ? "Password *" : "Reset password (optional)"}</Label>
            <Input id="u-pw" type="text" required={mode === "create"} value={form.password} onChange={(e) => set("password", e.target.value)} placeholder="Min 10 chars" />
          </div>
          {mode === "edit" && (
            <label className="col-span-2 flex items-center justify-between text-sm">
              <span>On leave (skipped by lead routing)</span>
              <Switch checked={form.onLeave} onCheckedChange={(v) => set("onLeave", v)} />
            </label>
          )}
          <DialogFooter className="col-span-2">
            <Button type="submit" disabled={saving}>{saving ? "Saving…" : mode === "create" ? "Create user" : "Save changes"}</Button>
          </DialogFooter>
        </form>

        {mode === "edit" && user?.active && (
          <div className="space-y-2 border-t pt-3">
            <p className="text-sm font-medium text-destructive">Deactivate user</p>
            <p className="text-xs text-muted-foreground">Optionally reassign their open leads, deals, clients and tasks to another rep.</p>
            <div className="flex gap-2">
              <Select value={reassignTo || "none"} onValueChange={(v) => setReassignTo(v === "none" ? "" : v)}>
                <SelectTrigger className="flex-1"><SelectValue placeholder="Don't reassign" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Don&apos;t reassign</SelectItem>
                  {activeUsers.map((u) => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}
                </SelectContent>
              </Select>
              <Button variant="destructive" disabled={saving} onClick={deactivate}>Deactivate</Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
