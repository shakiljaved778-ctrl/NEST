"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { fmtMoney } from "@/lib/utils";
import { createDealAction } from "@/app/(app)/deals/actions";

type LineItem = { productId: string; quantity: number; unitPrice: number };

export function NewDealDialog({
  pipelines,
  accounts,
  contacts,
  products,
  owners,
}: {
  pipelines: { id: string; name: string; stages: { id: string; name: string }[] }[];
  accounts: { id: string; legalName: string }[];
  contacts: { id: string; name: string }[];
  products: { id: string; name: string; price: number }[];
  owners: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [pipelineId, setPipelineId] = useState(pipelines[0]?.id ?? "");
  const pipeline = pipelines.find((p) => p.id === pipelineId);
  const [form, setForm] = useState({
    name: "",
    stageId: pipelines[0]?.stages[0]?.id ?? "",
    value: "",
    currency: "QAR",
    expectedCloseAt: "",
    accountId: "",
    primaryContactId: "",
    ownerId: "",
  });
  const [items, setItems] = useState<LineItem[]>([]);

  const itemsTotal = useMemo(() => items.reduce((s, i) => s + i.quantity * i.unitPrice, 0), [items]);

  function set<K extends keyof typeof form>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function addItem(productId: string) {
    const product = products.find((p) => p.id === productId);
    if (!product) return;
    setItems((prev) => [...prev, { productId, quantity: 1, unitPrice: product.price }]);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await createDealAction({
        name: form.name,
        pipelineId,
        stageId: form.stageId,
        value: form.value ? Number(form.value) : itemsTotal,
        currency: form.currency,
        expectedCloseAt: form.expectedCloseAt ? new Date(form.expectedCloseAt) : null,
        accountId: form.accountId || null,
        primaryContactId: form.primaryContactId || null,
        ownerId: form.ownerId || null,
        products: items,
      });
      if (res.ok) {
        toast.success("Deal created");
        setOpen(false);
        router.push(`/deals/${res.id}`);
      } else toast.error(res.error);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus /> New deal
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>New deal</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="grid grid-cols-2 gap-3">
          <div className="col-span-2 space-y-1">
            <Label htmlFor="nd-name">Deal name *</Label>
            <Input id="nd-name" required value={form.name} onChange={(e) => set("name", e.target.value)} />
          </div>
          {pipelines.length > 1 && (
            <div className="space-y-1">
              <Label>Pipeline</Label>
              <Select value={pipelineId} onValueChange={(v) => { setPipelineId(v); const p = pipelines.find((x) => x.id === v); if (p?.stages[0]) set("stageId", p.stages[0].id); }}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {pipelines.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="space-y-1">
            <Label>Stage</Label>
            <Select value={form.stageId} onValueChange={(v) => set("stageId", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {pipeline?.stages.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="nd-value">Value ({form.currency})</Label>
            <Input id="nd-value" type="number" min={0} placeholder={itemsTotal ? String(itemsTotal) : "0"} value={form.value} onChange={(e) => set("value", e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Currency</Label>
            <Select value={form.currency} onValueChange={(v) => set("currency", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {["QAR", "USD", "EUR", "SAR", "AED"].map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="nd-close">Expected close</Label>
            <Input id="nd-close" type="date" value={form.expectedCloseAt} onChange={(e) => set("expectedCloseAt", e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Owner</Label>
            <Select value={form.ownerId || "me"} onValueChange={(v) => set("ownerId", v === "me" ? "" : v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="me">Me</SelectItem>
                {owners.map((o) => <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Account (B2B)</Label>
            <Select value={form.accountId || "none"} onValueChange={(v) => set("accountId", v === "none" ? "" : v)}>
              <SelectTrigger><SelectValue placeholder="Account" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">—</SelectItem>
                {accounts.map((a) => <SelectItem key={a.id} value={a.id}>{a.legalName}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Primary contact</Label>
            <Select value={form.primaryContactId || "none"} onValueChange={(v) => set("primaryContactId", v === "none" ? "" : v)}>
              <SelectTrigger><SelectValue placeholder="Contact" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">—</SelectItem>
                {contacts.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="col-span-2 space-y-2 rounded-md border p-2">
            <div className="flex items-center justify-between">
              <Label>Products</Label>
              <Select value="" onValueChange={addItem}>
                <SelectTrigger className="h-8 w-44">
                  <SelectValue placeholder="Add product…" />
                </SelectTrigger>
                <SelectContent>
                  {products.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {items.map((item, idx) => {
              const product = products.find((p) => p.id === item.productId);
              return (
                <div key={idx} className="flex items-center gap-2 text-sm">
                  <span className="flex-1 truncate">{product?.name}</span>
                  <Input
                    type="number" min={1} className="h-8 w-16" value={item.quantity}
                    onChange={(e) => setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, quantity: Number(e.target.value) || 1 } : it)))}
                    aria-label="Quantity"
                  />
                  <Input
                    type="number" min={0} className="h-8 w-28" value={item.unitPrice}
                    onChange={(e) => setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, unitPrice: Number(e.target.value) || 0 } : it)))}
                    aria-label="Unit price"
                  />
                  <button type="button" onClick={() => setItems((prev) => prev.filter((_, i) => i !== idx))} aria-label="Remove line">
                    <Trash2 className="h-4 w-4 text-muted-foreground hover:text-destructive" />
                  </button>
                </div>
              );
            })}
            {items.length > 0 && (
              <p className="text-end text-sm font-medium">Line total: {fmtMoney(itemsTotal)}</p>
            )}
          </div>

          <DialogFooter className="col-span-2">
            <Button type="submit" disabled={saving}>{saving ? "Saving…" : "Create deal"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
