"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { upsertRoutingRuleAction, deleteRoutingRuleAction } from "@/app/(app)/admin/actions";

const SOURCES = ["web-form", "webhook", "csv-import", "referral", "event", "cold-call", "manual"];
const TERRITORIES = ["Doha North", "Doha South", "Al Rayyan", "Al Wakrah"];

type Rule = {
  id: string; name: string; priority: number; active: boolean; isFallback: boolean;
  criteria: Record<string, unknown>; targetType: string; targetTeamId: string | null; targetRepId: string | null; targetLabel: string;
};

export function RoutingManager({
  rules,
  teams,
  reps,
  products,
}: {
  rules: Rule[];
  teams: { id: string; name: string }[];
  reps: { id: string; name: string }[];
  products: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [editing, setEditing] = useState<Rule | "new" | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: "", priority: "10", active: true, isFallback: false,
    sources: [] as string[], territories: [] as string[], productIds: [] as string[],
    minScore: "", maxScore: "", targetType: "TEAM_ROUND_ROBIN", targetTeamId: "", targetRepId: "",
  });

  function openNew() {
    setForm({ name: "", priority: "10", active: true, isFallback: false, sources: [], territories: [], productIds: [], minScore: "", maxScore: "", targetType: "TEAM_ROUND_ROBIN", targetTeamId: teams[0]?.id ?? "", targetRepId: "" });
    setEditing("new");
  }

  function openEdit(rule: Rule) {
    const c = rule.criteria as { sources?: string[]; territories?: string[]; productIds?: string[]; minScore?: number; maxScore?: number };
    setForm({
      name: rule.name, priority: String(rule.priority), active: rule.active, isFallback: rule.isFallback,
      sources: c.sources ?? [], territories: c.territories ?? [], productIds: c.productIds ?? [],
      minScore: c.minScore != null ? String(c.minScore) : "", maxScore: c.maxScore != null ? String(c.maxScore) : "",
      targetType: rule.targetType, targetTeamId: rule.targetTeamId ?? "", targetRepId: rule.targetRepId ?? "",
    });
    setEditing(rule);
  }

  function toggleMulti(key: "sources" | "territories" | "productIds", value: string) {
    setForm((f) => ({ ...f, [key]: f[key].includes(value) ? f[key].filter((v) => v !== value) : [...f[key], value] }));
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const criteria: Record<string, unknown> = {};
      if (form.sources.length) criteria.sources = form.sources;
      if (form.territories.length) criteria.territories = form.territories;
      if (form.productIds.length) criteria.productIds = form.productIds;
      if (form.minScore) criteria.minScore = Number(form.minScore);
      if (form.maxScore) criteria.maxScore = Number(form.maxScore);
      const res = await upsertRoutingRuleAction({
        id: editing !== "new" && editing ? editing.id : undefined,
        name: form.name, priority: Number(form.priority), active: form.active, isFallback: form.isFallback,
        criteria, targetType: form.targetType,
        targetTeamId: form.targetType === "TEAM_ROUND_ROBIN" ? form.targetTeamId : null,
        targetRepId: form.targetType === "REP" ? form.targetRepId : null,
      });
      if (res.ok) { toast.success("Rule saved"); setEditing(null); router.refresh(); }
      else toast.error(res.error);
    } finally {
      setSaving(false);
    }
  }

  async function remove(rule: Rule) {
    if (!window.confirm(`Delete rule "${rule.name}"?`)) return;
    const res = await deleteRoutingRuleAction(rule.id);
    if (res.ok) { toast.success("Rule deleted"); router.refresh(); }
    else toast.error(res.error);
  }

  return (
    <div className="space-y-2">
      <div className="flex justify-end">
        <Button onClick={openNew}><Plus /> New rule</Button>
      </div>
      <div className="rounded-lg border bg-background">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-16">Priority</TableHead>
              <TableHead>Rule</TableHead>
              <TableHead>Criteria</TableHead>
              <TableHead>Target</TableHead>
              <TableHead>Status</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rules.map((rule) => {
              const c = rule.criteria as { sources?: string[]; territories?: string[]; productIds?: string[]; minScore?: number; maxScore?: number };
              const bits = [
                c.sources?.length ? `source: ${c.sources.join(", ")}` : null,
                c.territories?.length ? `territory: ${c.territories.join(", ")}` : null,
                c.productIds?.length ? `${c.productIds.length} product(s)` : null,
                c.minScore != null ? `score ≥ ${c.minScore}` : null,
                c.maxScore != null ? `score ≤ ${c.maxScore}` : null,
              ].filter(Boolean);
              return (
                <TableRow key={rule.id}>
                  <TableCell>{rule.isFallback ? <Badge variant="outline">fallback</Badge> : rule.priority}</TableCell>
                  <TableCell className="font-medium">{rule.name}</TableCell>
                  <TableCell className="max-w-xs text-xs text-muted-foreground">{bits.length ? bits.join(" · ") : rule.isFallback ? "matches all" : "—"}</TableCell>
                  <TableCell className="text-sm">
                    {rule.targetType === "REP" ? "Rep: " : "Team RR: "}
                    {rule.targetLabel}
                  </TableCell>
                  <TableCell>{rule.active ? <Badge variant="success">Active</Badge> : <Badge variant="secondary">Off</Badge>}</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <button onClick={() => openEdit(rule)} aria-label="Edit rule"><Pencil className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground" /></button>
                      <button onClick={() => remove(rule)} aria-label="Delete rule"><Trash2 className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" /></button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <Dialog open={editing !== null} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing === "new" ? "New routing rule" : "Edit routing rule"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={save} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2 space-y-1">
                <Label htmlFor="r-name">Name *</Label>
                <Input id="r-name" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="r-prio">Priority</Label>
                <Input id="r-prio" type="number" min={0} value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })} />
              </div>
              <div className="flex items-end gap-4">
                <label className="flex items-center gap-2 pb-2 text-sm"><Switch checked={form.active} onCheckedChange={(v) => setForm({ ...form, active: v })} /> Active</label>
                <label className="flex items-center gap-2 pb-2 text-sm"><Switch checked={form.isFallback} onCheckedChange={(v) => setForm({ ...form, isFallback: v })} /> Fallback</label>
              </div>
            </div>

            {!form.isFallback && (
              <div className="space-y-2 rounded-md border p-2">
                <p className="text-xs font-medium text-muted-foreground">Criteria (all must match)</p>
                <div>
                  <Label className="text-xs">Sources</Label>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {SOURCES.map((s) => (
                      <button type="button" key={s} onClick={() => toggleMulti("sources", s)}
                        className={`rounded-full border px-2 py-0.5 text-xs ${form.sources.includes(s) ? "border-primary bg-primary/10 text-primary" : "text-muted-foreground"}`}>
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <Label className="text-xs">Territories</Label>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {TERRITORIES.map((t) => (
                      <button type="button" key={t} onClick={() => toggleMulti("territories", t)}
                        className={`rounded-full border px-2 py-0.5 text-xs ${form.territories.includes(t) ? "border-primary bg-primary/10 text-primary" : "text-muted-foreground"}`}>
                        {t}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <Label className="text-xs">Product interest</Label>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {products.map((p) => (
                      <button type="button" key={p.id} onClick={() => toggleMulti("productIds", p.id)}
                        className={`rounded-full border px-2 py-0.5 text-xs ${form.productIds.includes(p.id) ? "border-primary bg-primary/10 text-primary" : "text-muted-foreground"}`}>
                        {p.name}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label className="text-xs">Min score</Label>
                    <Input type="number" min={0} max={100} value={form.minScore} onChange={(e) => setForm({ ...form, minScore: e.target.value })} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Max score</Label>
                    <Input type="number" min={0} max={100} value={form.maxScore} onChange={(e) => setForm({ ...form, maxScore: e.target.value })} />
                  </div>
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Target type</Label>
                <Select value={form.targetType} onValueChange={(v) => setForm({ ...form, targetType: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="TEAM_ROUND_ROBIN">Team round-robin</SelectItem>
                    <SelectItem value="REP">Specific rep</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Target</Label>
                {form.targetType === "TEAM_ROUND_ROBIN" ? (
                  <Select value={form.targetTeamId} onValueChange={(v) => setForm({ ...form, targetTeamId: v })}>
                    <SelectTrigger><SelectValue placeholder="Team" /></SelectTrigger>
                    <SelectContent>{teams.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}</SelectContent>
                  </Select>
                ) : (
                  <Select value={form.targetRepId} onValueChange={(v) => setForm({ ...form, targetRepId: v })}>
                    <SelectTrigger><SelectValue placeholder="Rep" /></SelectTrigger>
                    <SelectContent>{reps.map((r) => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}</SelectContent>
                  </Select>
                )}
              </div>
            </div>
            <DialogFooter>
              <Button type="submit" disabled={saving}>{saving ? "Saving…" : "Save rule"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
