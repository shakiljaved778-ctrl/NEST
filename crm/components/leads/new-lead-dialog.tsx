"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { createLeadAction, checkDuplicatesAction, mergeLeadsAction } from "@/app/(app)/leads/actions";

const SOURCES = ["manual", "referral", "event", "cold-call"];

type Dup = { id: string; firstName: string; lastName: string; email: string | null; phone: string | null; status: string; company: string | null };

export function NewLeadDialog({ products }: { products: { id: string; name: string }[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [dups, setDups] = useState<Dup[]>([]);
  const [form, setForm] = useState({
    firstName: "", lastName: "", company: "", email: "", phone: "",
    source: "manual", territory: "", productInterestId: "", score: "0", notes: "", consent: false,
  });

  function set<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function checkDups() {
    if (!form.email && !form.phone) return;
    const found = await checkDuplicatesAction(form.email || undefined, form.phone || undefined);
    setDups(found);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await createLeadAction({
        ...form,
        company: form.company || null,
        email: form.email || null,
        phone: form.phone || null,
        territory: form.territory || null,
        productInterestId: form.productInterestId || null,
        score: Number(form.score) || 0,
        notes: form.notes || null,
        consent: form.consent,
      });
      if (res.ok) {
        toast.success("Lead created");
        setOpen(false);
        router.push(`/leads/${res.id}`);
      } else toast.error(res.error);
    } finally {
      setSaving(false);
    }
  }

  async function createAndMerge(dupId: string) {
    // create the new lead, then merge the duplicate INTO it
    setSaving(true);
    try {
      const res = await createLeadAction({
        ...form,
        company: form.company || null,
        email: form.email || null,
        phone: form.phone || null,
        score: Number(form.score) || 0,
        consent: form.consent,
      });
      if (!res.ok) return toast.error(res.error);
      const merged = await mergeLeadsAction(res.id!, dupId);
      if (merged.ok) {
        toast.success("Lead created and duplicate merged");
        setOpen(false);
        router.push(`/leads/${res.id}`);
      } else toast.error(merged.error);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus /> New lead
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>New lead</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label htmlFor="nl-first">First name *</Label>
            <Input id="nl-first" required value={form.firstName} onChange={(e) => set("firstName", e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="nl-last">Last name *</Label>
            <Input id="nl-last" required value={form.lastName} onChange={(e) => set("lastName", e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="nl-email">Email</Label>
            <Input id="nl-email" type="email" value={form.email} onChange={(e) => set("email", e.target.value)} onBlur={checkDups} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="nl-phone">Phone</Label>
            <Input id="nl-phone" value={form.phone} onChange={(e) => set("phone", e.target.value)} onBlur={checkDups} placeholder="+974 …" />
          </div>
          {dups.length > 0 && (
            <div className="col-span-2 rounded-md border border-amber-300 bg-amber-50 p-2 text-sm">
              <p className="mb-1 flex items-center gap-1 font-medium text-amber-800">
                <AlertTriangle className="h-4 w-4" /> Possible duplicates found
              </p>
              {dups.map((d) => (
                <div key={d.id} className="flex items-center justify-between py-0.5">
                  <span>
                    {d.firstName} {d.lastName} · {d.email ?? d.phone} · {d.status}
                  </span>
                  <Button type="button" size="sm" variant="outline" disabled={saving} onClick={() => createAndMerge(d.id)}>
                    Create &amp; merge
                  </Button>
                </div>
              ))}
            </div>
          )}
          <div className="space-y-1">
            <Label htmlFor="nl-company">Company</Label>
            <Input id="nl-company" value={form.company} onChange={(e) => set("company", e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Source</Label>
            <Select value={form.source} onValueChange={(v) => set("source", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {SOURCES.map((s) => (
                  <SelectItem key={s} value={s}>{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Territory</Label>
            <Select value={form.territory || "none"} onValueChange={(v) => set("territory", v === "none" ? "" : v)}>
              <SelectTrigger><SelectValue placeholder="Territory" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">—</SelectItem>
                {["Doha North", "Doha South", "Al Rayyan", "Al Wakrah"].map((t) => (
                  <SelectItem key={t} value={t}>{t}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Product interest</Label>
            <Select value={form.productInterestId || "none"} onValueChange={(v) => set("productInterestId", v === "none" ? "" : v)}>
              <SelectTrigger><SelectValue placeholder="Product" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">—</SelectItem>
                {products.map((p) => (
                  <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="nl-score">Score (0–100)</Label>
            <Input id="nl-score" type="number" min={0} max={100} value={form.score} onChange={(e) => set("score", e.target.value)} />
          </div>
          <div className="col-span-2 space-y-1">
            <Label htmlFor="nl-notes">Notes</Label>
            <Textarea id="nl-notes" value={form.notes} onChange={(e) => set("notes", e.target.value)} />
          </div>
          <label className="col-span-2 flex items-center gap-2 text-sm">
            <Checkbox checked={form.consent} onCheckedChange={(c) => set("consent", c === true)} />
            Consent to processing recorded (PDPPL lawful basis)
          </label>
          <DialogFooter className="col-span-2">
            <Button type="submit" disabled={saving}>
              {saving ? "Saving…" : "Create lead"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
