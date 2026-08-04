"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { upsertProductAction } from "@/app/(app)/admin/actions";

export function ProductManager({
  mode,
  product,
}: {
  mode: "create" | "edit";
  product?: { id: string; name: string; description: string | null; pricingModel: string; price: number; active: boolean };
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: product?.name ?? "",
    description: product?.description ?? "",
    pricingModel: product?.pricingModel ?? "MONTHLY",
    price: String(product?.price ?? 0),
    active: product?.active ?? true,
  });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await upsertProductAction({
        id: product?.id,
        name: form.name,
        description: form.description || undefined,
        pricingModel: form.pricingModel,
        price: Number(form.price) || 0,
        active: form.active,
      });
      if (res.ok) { toast.success("Saved"); setOpen(false); router.refresh(); }
      else toast.error(res.error);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {mode === "create" ? <Button><Plus /> New product</Button> : <Button variant="ghost" size="icon" aria-label="Edit product"><Pencil className="h-4 w-4" /></Button>}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{mode === "create" ? "New product" : `Edit ${product?.name}`}</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="p-name">Name *</Label>
            <Input id="p-name" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="p-desc">Description</Label>
            <Textarea id="p-desc" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Pricing model</Label>
              <Select value={form.pricingModel} onValueChange={(v) => setForm({ ...form, pricingModel: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ONE_TIME">One-time</SelectItem>
                  <SelectItem value="MONTHLY">Monthly</SelectItem>
                  <SelectItem value="ANNUAL">Annual</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="p-price">Price (QAR)</Label>
              <Input id="p-price" type="number" min={0} value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} />
            </div>
          </div>
          <label className="flex items-center justify-between text-sm">
            <span>Active</span>
            <Switch checked={form.active} onCheckedChange={(v) => setForm({ ...form, active: v })} />
          </label>
          <DialogFooter>
            <Button type="submit" disabled={saving}>{saving ? "Saving…" : "Save"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
