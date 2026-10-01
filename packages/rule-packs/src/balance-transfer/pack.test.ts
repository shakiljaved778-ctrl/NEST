import { describe, expect, it } from "vitest";
import { balanceTransfer, thresholds } from "../fixtures";
import { PACKS } from "../registry";
import { evaluateBalanceTransfer } from "./pack";

const params = PACKS["card.balance_transfer"].conventional.defaultParameters;

describe("card.balance_transfer", () => {
  it("worked example: 2,000.00, 0% for 2 months, then 24%", () => {
    // fee max(2% × 2,000 = 40, 50) = 50.00
    // promo: minimum 100 twice -> 1,800.00 remaining
    // then 12 months at 24% paying max(5%, 100): 314.80; cost 50.00 + 314.80 = 364.80
    const ev = evaluateBalanceTransfer(
      balanceTransfer(),
      { ...params, promoMonths: 2, revertRatePct: "24.00" },
      thresholds,
    );
    expect([
      ev.facts.transferFee.value,
      ev.facts.remainingAfterPromo.value,
      ev.facts.chargeYearAfterPromo.value,
      ev.facts.costPromoAndYearAfter.value,
      ev.facts.revertRatePct.value,
      ev.severity,
    ]).toEqual(["50.00", "1800.00", "314.80", "364.80", "24.00", "critical"]);
    expect(ev.options).toEqual([
      "adjust_transfer_amount",
      "continue_balance_transfer",
      "talk_to_someone",
    ]);
  });

  it("default parameters: 6 months at 0%, then 30%", () => {
    // promo: 6 × 100 -> 1,400.00; the following year at 30%: 268.78; cost 318.78
    const ev = evaluateBalanceTransfer(balanceTransfer(), params, thresholds);
    expect([
      ev.facts.remainingAfterPromo.value,
      ev.facts.chargeYearAfterPromo.value,
      ev.facts.costPromoAndYearAfter.value,
    ]).toEqual(["1400.00", "268.78", "318.78"]);
  });

  it("charges the promo rate during the promo when it is not zero", () => {
    // 2,000 − 100 = 1,900 × 1% = 19.00 -> 1,919.00
    const ev = evaluateBalanceTransfer(
      balanceTransfer(),
      { ...params, promoRatePct: "12.00", promoMonths: 1 },
      thresholds,
    );
    expect(ev.facts.remainingAfterPromo.value).toBe("1919.00");
  });

  it("is not applicable for a zero amount", () => {
    expect(
      evaluateBalanceTransfer(balanceTransfer({ amount: "0.00" }), params, thresholds).applicable,
    ).toBe(false);
  });
});
