import {
  type TripOption,
  type Money,
  money,
  addMoney,
  bpsOf,
} from "@voyara/contracts";
import { Saga, type SagaStep, Ledger, transfer, Accounts } from "@voyara/ledger";
import type { LodgingAdapter, AirAdapter } from "@voyara/inventory-mesh";

export interface CheckoutDeps {
  lodging: LodgingAdapter;
  air?: AirAdapter;
  ledger: Ledger;
  /** Charge a tokenized payment mandate. Mock in dev; Stripe test in Phase 1. */
  charge: (amount: Money, mandate: string, idempotencyKey: string) => Promise<void>;
  /** Thin base booking margin, in basis points of total. */
  marginBps?: number;
}

export interface CheckoutRequest {
  option: TripOption;
  userId: string;
  paymentMandate: string;
  applyWallet?: boolean;
  walletBalance?: Money;
}

export interface CheckoutResult {
  bookingId: string;
  status: string;
  pnrRefs: Record<string, string>;
  totalCharged: Money;
  walletApplied: Money;
  compensated: string[];
  failedStep?: string;
}

interface CheckoutCtx {
  holds: Map<string, string>;
  pnrRefs: Record<string, string>;
  charged: boolean;
}

/**
 * Multi-supplier checkout saga: reserve holds → charge payment → confirm each
 * segment → post ledger entries. Any failure compensates in reverse. Card data
 * never touches this path — only a tokenized mandate does.
 */
export async function runCheckout(
  req: CheckoutRequest,
  deps: CheckoutDeps,
): Promise<CheckoutResult> {
  const { option, userId, paymentMandate } = req;
  const currency = option.totalPrice.currency;
  const bookingId = `bk_${option.id}_${Date.now().toString(36)}`;

  const walletApplied: Money =
    req.applyWallet && req.walletBalance
      ? money(
          Math.min(req.walletBalance.amountMinor, option.totalPrice.amountMinor),
          currency,
        )
      : money(0, currency);
  const cashToCharge = money(
    option.totalPrice.amountMinor - walletApplied.amountMinor,
    currency,
  );

  const ctx: CheckoutCtx = { holds: new Map(), pnrRefs: {}, charged: false };

  const steps: SagaStep<CheckoutCtx>[] = [];

  // reserve holds for every segment
  for (const seg of option.segments) {
    const adapter = seg.kind === "FLIGHT" ? deps.air : deps.lodging;
    steps.push({
      name: `hold:${seg.kind}`,
      idempotencyKey: () => `${bookingId}:hold:${seg.offer.id}`,
      execute: async (c) => {
        if (!adapter) throw new Error(`No adapter for ${seg.kind}`);
        const token = await adapter.hold(seg.offer.id);
        c.holds.set(seg.offer.id, token.token);
      },
      compensate: async (c) => {
        c.holds.delete(seg.offer.id); // mock release; real adapter would call release()
      },
    });
  }

  // charge payment (tokenized mandate)
  steps.push({
    name: "charge",
    idempotencyKey: () => `${bookingId}:charge`,
    execute: async (c) => {
      if (cashToCharge.amountMinor > 0) {
        await deps.charge(cashToCharge, paymentMandate, `${bookingId}:charge`);
      }
      c.charged = true;
    },
    compensate: async (c) => {
      // refund path would run here; ledger reversal handled by caller on failure
      c.charged = false;
    },
  });

  // confirm each segment + post ledger
  steps.push({
    name: "confirm",
    idempotencyKey: () => `${bookingId}:confirm`,
    execute: async (c) => {
      for (const seg of option.segments) {
        c.pnrRefs[seg.kind] = `PNR-${seg.offer.supplierRef.split(":").pop()}-${Math.floor(
          Math.random() * 9000 + 1000,
        )}`;
        // supplier payable (net) — booking margin is a thin spread we retain
        deps.ledger.post(
          transfer({
            from: Accounts.userCash(userId),
            to: Accounts.supplierPayable(seg.offer.supplierRef),
            amount: seg.offer.price,
            memo: `booking ${bookingId} ${seg.kind}`,
          }),
        );
      }
      // apply wallet credit if used
      if (walletApplied.amountMinor > 0) {
        deps.ledger.post(
          transfer({
            from: Accounts.userWallet(userId),
            to: Accounts.userCash(userId),
            amount: walletApplied,
            memo: `wallet applied to ${bookingId}`,
          }),
        );
      }
      // thin base booking margin as revenue
      const margin = bpsOf(option.totalPrice, deps.marginBps ?? 250); // 2.5%
      if (margin.amountMinor > 0) {
        deps.ledger.post(
          transfer({
            from: Accounts.userCash(userId),
            to: Accounts.voyaraRevenue("booking_margin"),
            amount: margin,
            memo: `booking margin ${bookingId}`,
          }),
        );
      }
    },
  });

  const saga = new Saga<CheckoutCtx>(bookingId, steps);
  const result = await saga.run(ctx);

  return {
    bookingId,
    status: result.ok ? "CONFIRMED" : "FAILED",
    pnrRefs: ctx.pnrRefs,
    totalCharged: cashToCharge,
    walletApplied,
    compensated: result.compensated,
    failedStep: result.failedStep,
  };
}
