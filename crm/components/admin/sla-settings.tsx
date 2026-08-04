"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent } from "@/components/ui/card";
import { saveSlaSettingsAction } from "@/app/(app)/admin/actions";

export function SlaSettingsForm({ settings }: { settings: { firstTouchMinutes: number; escalateAfterMinutes: number; reassignOnEscalate: boolean } }) {
  const router = useRouter();
  const [form, setForm] = useState({
    firstTouchMinutes: String(settings.firstTouchMinutes),
    escalateAfterMinutes: String(settings.escalateAfterMinutes),
    reassignOnEscalate: settings.reassignOnEscalate,
  });
  const [saving, setSaving] = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await saveSlaSettingsAction({
        firstTouchMinutes: Number(form.firstTouchMinutes),
        escalateAfterMinutes: Number(form.escalateAfterMinutes),
        reassignOnEscalate: form.reassignOnEscalate,
      });
      if (res.ok) { toast.success("SLA settings saved"); router.refresh(); }
      else toast.error(res.error);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardContent className="p-4">
        <form onSubmit={save} className="flex flex-wrap items-end gap-3">
          <div className="space-y-1">
            <Label htmlFor="sla-first">First touch within (min)</Label>
            <Input id="sla-first" type="number" min={1} className="w-40" value={form.firstTouchMinutes} onChange={(e) => setForm({ ...form, firstTouchMinutes: e.target.value })} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="sla-esc">Escalate after breach (min)</Label>
            <Input id="sla-esc" type="number" min={1} className="w-40" value={form.escalateAfterMinutes} onChange={(e) => setForm({ ...form, escalateAfterMinutes: e.target.value })} />
          </div>
          <label className="flex items-center gap-2 pb-2 text-sm">
            <Switch checked={form.reassignOnEscalate} onCheckedChange={(v) => setForm({ ...form, reassignOnEscalate: v })} />
            Re-route on escalation
          </label>
          <Button type="submit" disabled={saving}>{saving ? "Saving…" : "Save SLA"}</Button>
        </form>
      </CardContent>
    </Card>
  );
}
