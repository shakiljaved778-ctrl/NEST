"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { upsertKycItemAction } from "@/app/(app)/admin/actions";

type Item = { id: string; name: string; appliesTo: string; required: boolean; sortOrder: number; active: boolean };

export function KycConfig({ items }: { items: Item[] }) {
  const router = useRouter();
  const [editing, setEditing] = useState<Item | "new" | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: "", appliesTo: "BOTH", required: true, active: true });

  function openNew() {
    setForm({ name: "", appliesTo: "BOTH", required: true, active: true });
    setEditing("new");
  }
  function openEdit(item: Item) {
    setForm({ name: item.name, appliesTo: item.appliesTo, required: item.required, active: item.active });
    setEditing(item);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const sortOrder = editing !== "new" && editing ? editing.sortOrder : items.length;
      const res = await upsertKycItemAction({
        id: editing !== "new" && editing ? editing.id : undefined,
        name: form.name, appliesTo: form.appliesTo, required: form.required, sortOrder, active: form.active,
      });
      if (res.ok) { toast.success("Saved"); setEditing(null); router.refresh(); }
      else toast.error(res.error);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">Items shown on each client&apos;s KYC checklist (Client 360).</p>
        <Button onClick={openNew}><Plus /> New item</Button>
      </div>
      <div className="rounded-lg border bg-background">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Document</TableHead>
              <TableHead>Applies to</TableHead>
              <TableHead>Required</TableHead>
              <TableHead>Status</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((item) => (
              <TableRow key={item.id}>
                <TableCell className="font-medium">{item.name}</TableCell>
                <TableCell className="text-muted-foreground">{item.appliesTo === "BOTH" ? "B2B & B2C" : item.appliesTo === "ACCOUNT" ? "B2B" : "B2C"}</TableCell>
                <TableCell>{item.required ? <Badge variant="warning">Required</Badge> : <Badge variant="secondary">Optional</Badge>}</TableCell>
                <TableCell>{item.active ? <Badge variant="success">Active</Badge> : <Badge variant="secondary">Off</Badge>}</TableCell>
                <TableCell><button onClick={() => openEdit(item)} aria-label="Edit"><Pencil className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground" /></button></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={editing !== null} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing === "new" ? "New KYC item" : "Edit KYC item"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={save} className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor="k-name">Document name *</Label>
              <Input id="k-name" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. CR copy, QID, Authorized signatory letter" />
            </div>
            <div className="space-y-1">
              <Label>Applies to</Label>
              <Select value={form.appliesTo} onValueChange={(v) => setForm({ ...form, appliesTo: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="BOTH">B2B & B2C</SelectItem>
                  <SelectItem value="ACCOUNT">B2B accounts only</SelectItem>
                  <SelectItem value="CONTACT">B2C individuals only</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-6">
              <label className="flex items-center gap-2 text-sm"><Switch checked={form.required} onCheckedChange={(v) => setForm({ ...form, required: v })} /> Required</label>
              <label className="flex items-center gap-2 text-sm"><Switch checked={form.active} onCheckedChange={(v) => setForm({ ...form, active: v })} /> Active</label>
            </div>
            <DialogFooter>
              <Button type="submit" disabled={saving}>{saving ? "Saving…" : "Save"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
