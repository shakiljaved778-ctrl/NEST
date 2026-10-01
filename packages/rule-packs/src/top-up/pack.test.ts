import { describe, expect, it } from "vitest";
import { fatimaFinance, financeThresholds, NOW, topUp } from "../fixtures";
import { PACKS } from "../registry";
import { evaluateTopUp } from "./pack";

const params = PACKS["finance.top_up"].conventional.defaultParameters;
const ON = new Date("2026-02-25T10:00:00Z");

describe("finance.top_up", () => {
  it("worked example: the 3-month loan topped up by 1,000.00 over 12 months", () => {
    // refinanced 2,009.93 + 10 days' interest 6.61 + 1% fee 20.10 = 2,036.64; new 3,036.64
    // 12 months at 12%: 269.80 × 12 = 3,237.60; 2 months: 1,541.13 × 2 = 3,082.26
    // extension 155.34; fee max(1% × 1,000, 100) = 100.00; basis 255.34 (caution at 100/1,000)
    const ev = evaluateTopUp(topUp(), params, financeThresholds, ON);
    const v = Object.fromEntries(
      Object.entries(ev.facts)
        .filter(([k]) => k !== "_sources")
        .map(([k, f]) => [k, (f as { value: string }).value]),
    );
    expect(v).toEqual({
      topUpAmount: "1000.00",
      currentInstalment: "1020.07",
      remainingMonths: "2",
      remainingCost: "2040.13",
      refinancedAmount: "2036.64",
      newFinancedAmount: "3036.64",
      newTenorMonths: "12",
      newInstalment: "269.80",
      newTotalCost: "3237.60",
      totalCostSameTenor: "3082.26",
      extraCostOfExtension: "155.34",
      processingFee: "100.00",
    });
    expect([ev.applicable, ev.severity]).toEqual([true, "caution"]);
    expect(ev.options).toEqual(["choose_shorter_tenor", "continue_top_up", "talk_to_someone"]);
    expect(ev.explanation[0]).toBe("top_up_extends_tenor");
  });

  it("keeps the tenor: no extension cost and no shorter-tenor option", () => {
    const ev = evaluateTopUp(topUp({ newTenorMonths: 2 }), params, financeThresholds, ON);
    expect(ev.facts.extraCostOfExtension.value).toBe("0.00");
    expect(ev.options).toEqual(["continue_top_up", "talk_to_someone"]);
  });

  it("caps the tenor at the pack maximum", () => {
    const ev = evaluateTopUp(topUp({ newTenorMonths: 600 }), params, financeThresholds, ON);
    expect(ev.facts.newTenorMonths.value).toBe(String(params.maxTenorMonths));
  });

  it("prices murabaha flat on the new cost", () => {
    const fatima = fatimaFinance();
    const ev = evaluateTopUp(
      { ...fatima, topUpAmount: "20000.00", newTenorMonths: 60 },
      PACKS["finance.top_up"].islamic.defaultParameters,
      financeThresholds,
      NOW,
    );
    const amount = Number(ev.facts.newFinancedAmount.value);
    // flat: profit = cost × rate × 60/12; instalment = (cost + profit) / 60
    const rate = Number(fatima.finance.ratePct);
    const expected = (amount + Math.round(amount * rate * 5) / 100) / 60;
    expect(Number(ev.facts.newInstalment.value)).toBeCloseTo(expected, 1);
    expect(ev.facts.processingFee.value).toBe("200.00");
  });

  it("is not applicable once every instalment is paid", () => {
    const base = topUp();
    const ev = evaluateTopUp(
      {
        ...base,
        finance: {
          ...base.finance,
          schedule: base.finance.schedule.map((e) => ({ ...e, paid: true })),
        },
      },
      params,
      financeThresholds,
      ON,
    );
    expect(ev.applicable).toBe(false);
    expect([ev.facts.currentInstalment.value, ev.facts.totalCostSameTenor.value]).toEqual([
      "0.00",
      "0.00",
    ]);
  });
});
