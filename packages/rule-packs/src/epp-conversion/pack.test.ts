import { describe, expect, it } from "vitest";
import { eppConversion, thresholds } from "../fixtures";
import { PACKS } from "../registry";
import { evaluateEppConversion } from "./pack";

const params = PACKS["card.epp_conversion"].conventional.defaultParameters;

describe("card.epp_conversion", () => {
  it("worked example: 4,800.00 over 6 months, fee 1.5% min 50, 0% plan, card 30%", () => {
    // fee 4,800 × 1.5% = 72.00; instalment 800.00; total 4,872.00
    // revolving at 800 a month: 4,000 + 100.00; 3,300 + 82.50; 2,582.50 + 64.56; 1,847.06 + 46.18;
    //   1,093.24 + 27.33; 320.57 + 8.01; 328.58 paid in month 7 -> 328.58
    const ev = evaluateEppConversion(eppConversion(), params, thresholds);
    const v = Object.fromEntries(
      Object.entries(ev.facts)
        .filter(([k]) => k !== "_sources")
        .map(([k, f]) => [k, (f as { value: string }).value]),
    );
    expect(v).toEqual({
      purchaseAmount: "4800.00",
      planMonths: "6",
      planMonthlyInstalment: "800.00",
      planProcessingFee: "72.00",
      planCharge: "0.00",
      planTotalCost: "4872.00",
      extraCostVsPayInFull: "72.00",
      chargeIfRevolved: "328.58",
      planEarlyClosureFeePct: "2.00",
    });
    expect([ev.applicable, ev.severity]).toEqual([true, "caution"]);
    expect(ev.options).toEqual(["pay_in_full", "continue_epp", "talk_to_someone"]);
  });

  it("applies the minimum fee and a flat plan rate", () => {
    // 1,200 × 1.5% = 18 -> min 50.00; profit 1,200 × 6% × 3/12 = 18.00; instalment 406.00
    const ev = evaluateEppConversion(
      eppConversion({ purchase: { amount: "1200.00" }, months: 3 }),
      { ...params, planRatePct: "6.00" },
      thresholds,
    );
    expect([
      ev.facts.planProcessingFee.value,
      ev.facts.planCharge.value,
      ev.facts.planMonthlyInstalment.value,
      ev.facts.planTotalCost.value,
      ev.facts.extraCostVsPayInFull.value,
    ]).toEqual(["50.00", "18.00", "406.00", "1268.00", "68.00"]);
  });

  it.each([
    ["below the minimum amount", { purchase: { amount: "999.99" } }],
    ["a term the bank does not offer", { months: 9 }],
  ])("is not applicable for %s", (_name, overrides) => {
    expect(evaluateEppConversion(eppConversion(overrides), params, thresholds).applicable).toBe(
      false,
    );
  });
});
