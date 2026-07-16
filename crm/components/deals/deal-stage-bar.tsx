"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { moveDealStageAction } from "@/app/(app)/deals/actions";
import { LossReasonDialog, WonSubscriptionsDialog, type ProductOpt } from "./kanban";

export function DealStageBar({
  dealId,
  currentStageId,
  status,
  stages,
  products,
  readOnly,
}: {
  dealId: string;
  currentStageId: string;
  status: string;
  stages: { id: string; name: string; probability: number; type: "OPEN" | "WON" | "LOST" }[];
  products: ProductOpt[];
  readOnly: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [lossFor, setLossFor] = useState<string | null>(null);
  const [wonOpen, setWonOpen] = useState(false);

  const currentIdx = stages.findIndex((s) => s.id === currentStageId);

  function move(stageId: string, opts: { lossReason?: string } = {}) {
    startTransition(async () => {
      const res = await moveDealStageAction(dealId, stageId, opts);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      if (res.closedWon) {
        toast.success("Deal won 🎉");
        setWonOpen(true);
      }
      router.refresh();
    });
  }

  return (
    <>
      <div className="flex flex-wrap gap-1">
        {stages.map((stage, i) => {
          const isCurrent = stage.id === currentStageId;
          const passed = i < currentIdx && status !== "LOST";
          return (
            <button
              key={stage.id}
              disabled={readOnly || pending || isCurrent}
              onClick={() => {
                if (stage.type === "LOST") setLossFor(stage.id);
                else move(stage.id);
              }}
              className={cn(
                "flex-1 whitespace-nowrap rounded-md border px-3 py-1.5 text-xs font-medium transition-colors disabled:cursor-default",
                isCurrent
                  ? stage.type === "WON"
                    ? "border-emerald-600 bg-emerald-600 text-white"
                    : stage.type === "LOST"
                      ? "border-destructive bg-destructive text-destructive-foreground"
                      : "border-primary bg-primary text-primary-foreground"
                  : passed
                    ? "border-primary/40 bg-primary/10 text-primary"
                    : "bg-background text-muted-foreground hover:bg-accent"
              )}
            >
              {stage.name}
            </button>
          );
        })}
      </div>
      <LossReasonDialog
        open={lossFor !== null}
        onClose={() => setLossFor(null)}
        onConfirm={(reason) => {
          if (lossFor) move(lossFor, { lossReason: reason });
          setLossFor(null);
        }}
      />
      <WonSubscriptionsDialog dealId={wonOpen ? dealId : null} products={products} onClose={() => setWonOpen(false)} />
    </>
  );
}
