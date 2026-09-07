"use client";
import type { PlanTier } from "@/types/market";

export function PlanBadge({ plan }: { plan: PlanTier }) {
  if (plan === "premium") {
    return (
      <span className="t-chip bg-terminal-warn/15 text-terminal-warn">★ Premium</span>
    );
  }
  return <span className="t-chip bg-terminal-panel2 text-terminal-muted">Free</span>;
}
