"use client";

import { useMemo, useOptimistic, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { fmtMoney, fmtDate, cn } from "@/lib/utils";
import { moveDealStageAction, createSubscriptionsAction } from "@/app/(app)/deals/actions";

export type KanbanDeal = {
  id: string;
  name: string;
  value: number;
  currency: string;
  stageId: string;
  stageName: string;
  status: string;
  owner: string | null;
  account: string | null;
  expectedCloseAt: string | null;
  updatedAt: string;
};

export type KanbanStage = { id: string; name: string; probability: number; type: "OPEN" | "WON" | "LOST" };
export type ProductOpt = { id: string; name: string; price: number; pricingModel: string };

const LOSS_REASONS = ["Price too high", "Chose competitor", "No budget", "Bad timing", "Missing feature", "No decision", "Other"];

export function KanbanBoard({
  stages,
  deals,
  readOnly,
  products,
}: {
  stages: KanbanStage[];
  deals: KanbanDeal[];
  readOnly: boolean;
  products: ProductOpt[];
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [optimisticDeals, applyMove] = useOptimistic(
    deals,
    (state, move: { dealId: string; toStageId: string; toStageName: string }) =>
      state.map((d) => (d.id === move.dealId ? { ...d, stageId: move.toStageId, stageName: move.toStageName } : d))
  );
  const [dragOver, setDragOver] = useState<string | null>(null);
  const [lossDialog, setLossDialog] = useState<{ dealId: string; toStageId: string } | null>(null);
  const [wonDialog, setWonDialog] = useState<{ dealId: string } | null>(null);

  const byStage = useMemo(() => {
    const map = new Map<string, KanbanDeal[]>();
    for (const s of stages) map.set(s.id, []);
    for (const d of optimisticDeals) map.get(d.stageId)?.push(d);
    return map;
  }, [stages, optimisticDeals]);

  function commitMove(dealId: string, toStageId: string, opts: { lossReason?: string } = {}) {
    const stage = stages.find((s) => s.id === toStageId);
    startTransition(async () => {
      applyMove({ dealId, toStageId, toStageName: stage?.name ?? "" });
      const res = await moveDealStageAction(dealId, toStageId, opts);
      if (!res.ok) {
        toast.error(res.error);
        router.refresh();
        return;
      }
      if (res.closedWon) {
        toast.success("Deal won 🎉");
        setWonDialog({ dealId });
      }
      router.refresh();
    });
  }

  function onDrop(e: React.DragEvent, stageId: string) {
    e.preventDefault();
    setDragOver(null);
    const dealId = e.dataTransfer.getData("text/deal-id");
    if (!dealId) return;
    const deal = deals.find((d) => d.id === dealId);
    if (!deal || deal.stageId === stageId) return;
    const stage = stages.find((s) => s.id === stageId);
    if (stage?.type === "LOST") {
      setLossDialog({ dealId, toStageId: stageId });
      return;
    }
    commitMove(dealId, stageId);
  }

  return (
    <>
      <div className="flex gap-3 overflow-x-auto pb-2">
        {stages.map((stage) => {
          const items = byStage.get(stage.id) ?? [];
          const total = items.reduce((s, d) => s + d.value, 0);
          return (
            <div
              key={stage.id}
              className={cn(
                "flex w-64 shrink-0 flex-col rounded-lg border bg-muted/40",
                dragOver === stage.id && "ring-2 ring-primary"
              )}
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(stage.id);
              }}
              onDragLeave={() => setDragOver((s) => (s === stage.id ? null : s))}
              onDrop={(e) => onDrop(e, stage.id)}
            >
              <div className="border-b p-2">
                <div className="flex items-center justify-between text-sm font-medium">
                  <span>{stage.name}</span>
                  <span className="text-xs text-muted-foreground">{items.length}</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  {fmtMoney(total)} · {stage.probability}%
                </p>
              </div>
              <div className="flex flex-1 flex-col gap-2 p-2">
                {items.map((deal) => (
                  <div
                    key={deal.id}
                    draggable={!readOnly}
                    onDragStart={(e) => e.dataTransfer.setData("text/deal-id", deal.id)}
                    className={cn(
                      "rounded-md border bg-background p-2 shadow-sm",
                      !readOnly && "cursor-grab active:cursor-grabbing"
                    )}
                  >
                    <Link href={`/deals/${deal.id}`} className="block text-sm font-medium text-primary hover:underline">
                      {deal.name}
                    </Link>
                    <p className="text-xs text-muted-foreground">{deal.account ?? "No account"}</p>
                    <div className="mt-1 flex items-center justify-between text-xs">
                      <span className="font-semibold">{fmtMoney(deal.value, deal.currency)}</span>
                      <span className="text-muted-foreground">
                        {deal.expectedCloseAt ? fmtDate(deal.expectedCloseAt) : ""}
                      </span>
                    </div>
                    {deal.owner && <p className="mt-1 text-xs text-muted-foreground">{deal.owner}</p>}
                  </div>
                ))}
                {items.length === 0 && (
                  <p className="py-4 text-center text-xs text-muted-foreground">Drop deals here</p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <LossReasonDialog
        open={lossDialog !== null}
        onClose={() => setLossDialog(null)}
        onConfirm={(reason) => {
          if (lossDialog) commitMove(lossDialog.dealId, lossDialog.toStageId, { lossReason: reason });
          setLossDialog(null);
        }}
      />
      <WonSubscriptionsDialog
        dealId={wonDialog?.dealId ?? null}
        products={products}
        onClose={() => setWonDialog(null)}
      />
    </>
  );
}

export function LossReasonDialog({
  open,
  onClose,
  onConfirm,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => void;
}) {
  const [reason, setReason] = useState("");
  const [other, setOther] = useState("");
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Close deal as lost</DialogTitle>
          <DialogDescription>A loss reason is required.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <Select value={reason} onValueChange={setReason}>
            <SelectTrigger>
              <SelectValue placeholder="Choose a reason" />
            </SelectTrigger>
            <SelectContent>
              {LOSS_REASONS.map((r) => (
                <SelectItem key={r} value={r}>{r}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {reason === "Other" && (
            <Input placeholder="Describe the reason" value={other} onChange={(e) => setOther(e.target.value)} />
          )}
        </div>
        <DialogFooter>
          <Button
            variant="destructive"
            disabled={!reason || (reason === "Other" && !other.trim())}
            onClick={() => onConfirm(reason === "Other" ? other.trim() : reason)}
          >
            Close as lost
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function WonSubscriptionsDialog({
  dealId,
  products,
  onClose,
}: {
  dealId: string | null;
  products: ProductOpt[];
  onClose: () => void;
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10));
  const [saving, setSaving] = useState(false);

  async function submit() {
    if (!dealId) return;
    const items = products
      .filter((p) => selected[p.id])
      .map((p) => {
        const start = new Date(startDate);
        const renewal = new Date(start);
        if (p.pricingModel === "ANNUAL") renewal.setUTCFullYear(renewal.getUTCFullYear() + 1);
        else renewal.setUTCFullYear(renewal.getUTCFullYear() + 1); // monthly contracts renew annually too
        return {
          productId: p.id,
          startDate: start,
          renewalDate: p.pricingModel === "ONE_TIME" ? null : renewal,
          mrrValue: p.pricingModel === "MONTHLY" ? p.price : p.pricingModel === "ANNUAL" ? Math.round(p.price / 12) : 0,
        };
      });
    if (items.length === 0) return onClose();
    setSaving(true);
    try {
      const res = await createSubscriptionsAction(dealId, items);
      if (res.ok) {
        toast.success("Subscriptions created");
        onClose();
        router.refresh();
      } else toast.error(res.error);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={dealId !== null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Deal won — create subscriptions?</DialogTitle>
          <DialogDescription>
            Select the products the client purchased to create subscription records with renewal tracking.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <div className="space-y-1">
            <Label htmlFor="sub-start">Start date</Label>
            <Input id="sub-start" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </div>
          {products.map((p) => (
            <label key={p.id} className="flex items-center gap-2 text-sm">
              <Checkbox checked={!!selected[p.id]} onCheckedChange={(c) => setSelected((s) => ({ ...s, [p.id]: c === true }))} />
              {p.name}
              <span className="ms-auto text-xs text-muted-foreground">
                {fmtMoney(p.price)} / {p.pricingModel.toLowerCase().replace("_", "-")}
              </span>
            </label>
          ))}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Skip</Button>
          <Button onClick={submit} disabled={saving}>
            {saving ? "Creating…" : "Create subscriptions"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
