import {
  type GuardianEventKind,
  type RemediationState,
  type Money,
  type AutonomyTier,
  money,
  subMoney,
  bpsOf,
} from "@voyara/contracts";

/**
 * Guardian daemon (Phase 2 target: NestJS scheduled worker + BullMQ/Redis).
 * Phase 0 ships the pure remediation logic these monitors will call, so the
 * negative-CAC rebate loop and consent-tier gating are already testable.
 */
export interface GuardianEvent {
  tripId: string;
  kind: GuardianEventKind;
  payload: Record<string, unknown>;
  detectedAt: string;
  remediation: RemediationState;
  savingsMinor: number;
}

export interface Remediation {
  execute: boolean; // auto-execute vs propose (per autonomy tier)
  message: string; // one-tap approve/decline copy for Companion push
  savings?: Money;
  successFee?: Money; // Voyara's 20% success fee on documented saving
}

/** Voyara's success fee on a documented saving is 20% (2000 bps). */
export const SUCCESS_FEE_BPS = 2000;

/**
 * Re-price scan: a booked refundable rate dropped. Auto-rebook cheaper and
 * refund the difference to wallet as credit; Voyara retains 20% of the saving.
 */
export function evaluatePriceDrop(
  bookedPrice: Money,
  newPrice: Money,
  tier: AutonomyTier,
  actCapMinor: number,
): Remediation {
  const saving = subMoney(bookedPrice, newPrice);
  if (saving.amountMinor <= 0) {
    return { execute: false, message: "No cheaper rate found." };
  }
  const successFee = bpsOf(saving, SUCCESS_FEE_BPS);
  // Rebooking a cheaper refundable rate is money-neutral to the traveler and
  // refundable, so ASK+ may auto-execute; ACT auto-executes within the cap.
  const execute =
    tier === "ACT"
      ? newPrice.amountMinor <= actCapMinor
      : tier === "ASK";
  return {
    execute,
    message: execute
      ? `Rebooked ${money(saving.amountMinor, saving.currency).currency} cheaper — ${fmt(saving)} back to your wallet.`
      : `Found ${fmt(saving)} cheaper. Approve the rebooking?`,
    savings: saving,
    successFee,
  };
}

/**
 * Disruption (delay/cancel): propose or auto-hold an alternative per tier.
 * A free/refundable hold may be placed automatically at ASK+.
 */
export function evaluateDisruption(
  kind: Extract<GuardianEventKind, "DELAY" | "CANCEL" | "SCHEDULE_CHANGE">,
  heldAlternative: string | null,
  tier: AutonomyTier,
): Remediation {
  const canAutoHold = tier !== "WATCH" && heldAlternative != null;
  const label =
    kind === "DELAY" ? "delayed" : kind === "CANCEL" ? "cancelled" : "retimed";
  return {
    execute: canAutoHold,
    message: heldAlternative
      ? `Your segment was ${label} — I've held ${heldAlternative}. ${canAutoHold ? "Confirm?" : "Approve to hold?"}`
      : `Your segment was ${label}. Searching alternatives…`,
  };
}

function fmt(m: Money): string {
  return `${m.currency} ${(m.amountMinor / 100).toFixed(2)}`;
}
