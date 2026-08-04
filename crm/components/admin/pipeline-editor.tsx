"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { createPipelineAction, upsertStageAction, deleteStageAction } from "@/app/(app)/admin/actions";

type Stage = { id: string; name: string; probability: number; type: string; sortOrder: number; dealCount: number };
type Pipeline = { id: string; name: string; isDefault: boolean; stages: Stage[] };

export function PipelineEditor({ pipelines }: { pipelines: Pipeline[] }) {
  const router = useRouter();
  const [editing, setEditing] = useState<{ pipelineId: string; stage?: Stage } | null>(null);
  const [stageForm, setStageForm] = useState({ name: "", probability: "10", type: "OPEN" });
  const [saving, setSaving] = useState(false);

  async function newPipeline() {
    const name = window.prompt("New pipeline name:");
    if (!name) return;
    const res = await createPipelineAction(name);
    if (res.ok) { toast.success("Pipeline created"); router.refresh(); }
    else toast.error(res.error);
  }

  function openStage(pipelineId: string, stage?: Stage) {
    setEditing({ pipelineId, stage });
    setStageForm({ name: stage?.name ?? "", probability: String(stage?.probability ?? 10), type: stage?.type ?? "OPEN" });
  }

  async function saveStage(e: React.FormEvent) {
    e.preventDefault();
    if (!editing) return;
    setSaving(true);
    try {
      const pipeline = pipelines.find((p) => p.id === editing.pipelineId)!;
      const sortOrder = editing.stage?.sortOrder ?? pipeline.stages.length;
      const res = await upsertStageAction({
        id: editing.stage?.id,
        pipelineId: editing.pipelineId,
        name: stageForm.name,
        probability: Number(stageForm.probability),
        type: stageForm.type,
        sortOrder,
      });
      if (res.ok) { toast.success("Stage saved"); setEditing(null); router.refresh(); }
      else toast.error(res.error);
    } finally {
      setSaving(false);
    }
  }

  async function removeStage(stage: Stage) {
    if (!window.confirm(`Delete stage "${stage.name}"?`)) return;
    const res = await deleteStageAction(stage.id);
    if (res.ok) { toast.success("Stage deleted"); router.refresh(); }
    else toast.error(res.error);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{pipelines.length} pipelines</p>
        <Button onClick={newPipeline}><Plus /> New pipeline</Button>
      </div>

      {pipelines.map((pipeline) => (
        <Card key={pipeline.id}>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-base">
                {pipeline.name}
                {pipeline.isDefault && <Badge variant="info">Default</Badge>}
              </CardTitle>
              <Button size="sm" variant="outline" onClick={() => openStage(pipeline.id)}>
                <Plus /> Add stage
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-1">
              {pipeline.stages.map((stage) => (
                <div key={stage.id} className="flex items-center gap-2 rounded-md border p-2 text-sm">
                  <span className="w-6 text-xs text-muted-foreground">{stage.sortOrder + 1}</span>
                  <span className="flex-1 font-medium">{stage.name}</span>
                  <Badge variant={stage.type === "WON" ? "success" : stage.type === "LOST" ? "destructive" : "secondary"}>
                    {stage.type}
                  </Badge>
                  <span className="w-16 text-end text-muted-foreground">{stage.probability}%</span>
                  <span className="w-20 text-end text-xs text-muted-foreground">{stage.dealCount} deals</span>
                  <button onClick={() => openStage(pipeline.id, stage)} aria-label="Edit stage"><Pencil className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground" /></button>
                  <button onClick={() => removeStage(stage)} aria-label="Delete stage"><Trash2 className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" /></button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ))}

      <Dialog open={editing !== null} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing?.stage ? "Edit stage" : "Add stage"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={saveStage} className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor="s-name">Name *</Label>
              <Input id="s-name" required value={stageForm.name} onChange={(e) => setStageForm({ ...stageForm, name: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="s-prob">Probability (%)</Label>
                <Input id="s-prob" type="number" min={0} max={100} value={stageForm.probability} onChange={(e) => setStageForm({ ...stageForm, probability: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label>Type</Label>
                <Select value={stageForm.type} onValueChange={(v) => setStageForm({ ...stageForm, type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="OPEN">Open</SelectItem>
                    <SelectItem value="WON">Won</SelectItem>
                    <SelectItem value="LOST">Lost</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button type="submit" disabled={saving}>{saving ? "Saving…" : "Save stage"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
