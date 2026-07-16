"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { upsertCustomFieldAction, deleteCustomFieldAction } from "@/app/(app)/admin/actions";

type Field = { id: string; entity: string; key: string; label: string; type: string; options: string[]; required: boolean };
const ENTITIES = ["LEAD", "ACCOUNT", "CONTACT", "DEAL"];

export function CustomFieldsManager({ fields }: { fields: Field[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ entity: "LEAD", label: "", type: "TEXT", options: "", required: false });

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const key = form.label.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
      const res = await upsertCustomFieldAction({
        entity: form.entity, key, label: form.label, type: form.type,
        options: form.type === "SELECT" ? form.options.split(",").map((o) => o.trim()).filter(Boolean) : [],
        required: form.required,
      });
      if (res.ok) { toast.success("Field created"); setOpen(false); setForm({ entity: "LEAD", label: "", type: "TEXT", options: "", required: false }); router.refresh(); }
      else toast.error(res.error);
    } finally {
      setSaving(false);
    }
  }

  async function remove(field: Field) {
    if (!window.confirm(`Delete custom field "${field.label}"? Existing stored values remain on records but stop showing.`)) return;
    const res = await deleteCustomFieldAction(field.id);
    if (res.ok) { toast.success("Field deleted"); router.refresh(); }
    else toast.error(res.error);
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">Add fields to Lead / Account / Contact / Deal without code. Values are stored on each record.</p>
        <Button onClick={() => setOpen(true)}><Plus /> New field</Button>
      </div>
      <div className="rounded-lg border bg-background">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Entity</TableHead>
              <TableHead>Label</TableHead>
              <TableHead>Key</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Required</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {fields.length === 0 && (
              <TableRow><TableCell colSpan={6} className="py-8 text-center text-muted-foreground">No custom fields yet</TableCell></TableRow>
            )}
            {fields.map((f) => (
              <TableRow key={f.id}>
                <TableCell><Badge variant="outline">{f.entity}</Badge></TableCell>
                <TableCell className="font-medium">{f.label}</TableCell>
                <TableCell className="font-mono text-xs text-muted-foreground">{f.key}</TableCell>
                <TableCell className="text-muted-foreground">{f.type.toLowerCase()}{f.type === "SELECT" && f.options.length ? ` (${f.options.join(", ")})` : ""}</TableCell>
                <TableCell>{f.required ? "Yes" : "No"}</TableCell>
                <TableCell><button onClick={() => remove(f)} aria-label="Delete"><Trash2 className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" /></button></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New custom field</DialogTitle>
          </DialogHeader>
          <form onSubmit={save} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Entity</Label>
                <Select value={form.entity} onValueChange={(v) => setForm({ ...form, entity: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{ENTITIES.map((e) => <SelectItem key={e} value={e}>{e}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Type</Label>
                <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="TEXT">Text</SelectItem>
                    <SelectItem value="NUMBER">Number</SelectItem>
                    <SelectItem value="DATE">Date</SelectItem>
                    <SelectItem value="SELECT">Select</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1">
              <Label htmlFor="cf-label">Label *</Label>
              <Input id="cf-label" required value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} />
            </div>
            {form.type === "SELECT" && (
              <div className="space-y-1">
                <Label htmlFor="cf-opts">Options (comma-separated)</Label>
                <Input id="cf-opts" value={form.options} onChange={(e) => setForm({ ...form, options: e.target.value })} placeholder="Bronze, Silver, Gold" />
              </div>
            )}
            <label className="flex items-center gap-2 text-sm"><Switch checked={form.required} onCheckedChange={(v) => setForm({ ...form, required: v })} /> Required</label>
            <DialogFooter>
              <Button type="submit" disabled={saving}>{saving ? "Saving…" : "Create field"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
