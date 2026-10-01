import { describe, expect, it } from "vitest";
import { cashWithdrawal, thresholds } from "../fixtures";
import { PACKS } from "../registry";
import { evaluateCashWithdrawal } from "./pack";

const params = PACKS["card.cash_withdrawal"].conventional.defaultParameters;
const facts = (ev: ReturnType<typeof evaluateCashWithdrawal>) =>
  Object.fromEntries(
    Object.entries(ev.facts)
      .filter(([k]) => k !== "_sources")
      .map(([k, f]) => [k, (f as { value: string }).value]),
  );

describe("card.cash_withdrawal", () => {
  it("worked example: 1,000.00 at 30%, fee 3% min 60", () => {
    const ev = evaluateCashWithdrawal(cashWithdrawal(), params, thresholds);
    // fee max(30.00, 60.00) = 60.00
    // 30 days: 1,000 × 30% × 30/365 = 24.657 -> 24.66 => 84.66
    // 60 days: 1,000 × 30% × 60/365 = 49.315 -> 49.32 => 109.32
    expect(facts(ev)).toEqual({
      withdrawalAmount: "1000.00",
      cashFee: "60.00",
      cashFeePct: "3.00",
      cashFeeMin: "60.00",
      aprPct: "30.00",
      shortHorizonDays: "30",
      costIfRepaidShort: "84.66",
      longHorizonDays: "60",
      costIfRepaidLong: "109.32",
      availableCredit: "8000.00",
      exceedsAvailableCredit: "false",
    });
    expect(ev.applicable).toBe(true);
    expect(ev.severity).toBe("caution");
    expect(ev.options).toEqual(["use_debit_card", "continue_withdrawal", "talk_to_someone"]);
    expect(ev.explanation[0]).toBe("cash_withdrawal_fee_applies");
  });

  it.each([
    // 5,000 × 3% = 150.00 (> min); 30 days: 5,000 × 30% × 30/365 = 123.29 => 273.29 critical
    ["5000.00", "150.00", "273.29", "critical"],
    // 2,000: fee 60.00; 30 days 49.32 => 109.32
    ["2000.00", "60.00", "109.32", "caution"],
  ])("%s: fee %s, 30-day cost %s (%s)", (amount, fee, cost, severity) => {
    const ev = evaluateCashWithdrawal(cashWithdrawal({ amount }), params, thresholds);
    expect([ev.facts.cashFee.value, ev.facts.costIfRepaidShort.value, ev.severity]).toEqual([
      fee,
      cost,
      severity,
    ]);
  });

  it("flags a withdrawal above the available credit, never negative", () => {
    const base = cashWithdrawal();
    const ev = evaluateCashWithdrawal(
      { ...base, card: { ...base.card, balance: "10500.00" }, amount: "500.00" },
      params,
      thresholds,
    );
    expect(ev.facts.availableCredit.value).toBe("0.00");
    expect(ev.facts.exceedsAvailableCredit.value).toBe("true");
    expect(ev.explanation[0]).toBe("withdrawal_exceeds_available_credit");
  });

  it("is not applicable for a zero amount", () => {
    expect(
      evaluateCashWithdrawal(cashWithdrawal({ amount: "0.00" }), params, thresholds).applicable,
    ).toBe(false);
  });
});
