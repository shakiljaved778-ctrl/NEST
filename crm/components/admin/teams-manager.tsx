"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { createTeamAction, updateTeamAction } from "@/app/(app)/admin/actions";

const TERRITORIES = ["Doha North", "Doha South", "Al Rayyan", "Al Wakrah"];

export function TeamsManager({
  mode,
  leads,
  team,
}: {
  mode: "create" | "edit";
  leads: { id: string; name: string }[];
  team?: { id: string; name: string; territory: string | null; productLine: string | null; teamLeadId: string | null };
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: team?.name ?? "",
    territory: team?.territory ?? "",
    productLine: team?.productLine ?? "",
    teamLeadId: team?.teamLeadId ?? "",
  });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        name: form.name,
        territory: form.territory || undefined,
        productLine: form.productLine || undefined,
        teamLeadId: form.teamLeadId || undefined,
      };
      const res = mode === "create"
        ? await createTeamAction(payload)
        : await updateTeamAction(team!.id, { name: form.name, territory: form.territory || null, productLine: form.productLine || null, teamLeadId: form.teamLeadId || null });
      if (res.ok) { toast.success(mode === "create" ? "Team created" : "Team updated"); setOpen(false); router.refresh(); }
      else toast.error(res.error);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {mode === "create" ? <Button><Plus /> New team</Button> : <Button variant="ghost" size="icon" aria-label="Edit team"><Pencil className="h-4 w-4" /></Button>}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{mode === "create" ? "New team" : `Edit ${team?.name}`}</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="t-name">Name *</Label>
            <Input id="t-name" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div className="space-y-1">
            <Label>Team lead</Label>
            <Select value={form.teamLeadId || "none"} onValueChange={(v) => setForm({ ...form, teamLeadId: v === "none" ? "" : v })}>
              <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">—</SelectItem>
                {leads.map((l) => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Territory</Label>
            <Select value={form.territory || "none"} onValueChange={(v) => setForm({ ...form, territory: v === "none" ? "" : v })}>
              <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">—</SelectItem>
                {TERRITORIES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="t-pl">Product line</Label>
            <Input id="t-pl" value={form.productLine} onChange={(e) => setForm({ ...form, productLine: e.target.value })} />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={saving}>{saving ? "Saving…" : "Save"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
