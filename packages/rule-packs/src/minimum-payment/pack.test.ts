import { describe, expect, it } from "vitest";
import { minimumPayment, thresholds } from "../fixtures";
import { PACKS } from "../registry";
import { evaluateMinimumPayment } from "./pack";

const params = PACKS["card.minimum_payment"].conventional.defaultParameters;
const values = (ev: ReturnType<typeof evaluateMinimumPayment>, keys: string[]) =>
  keys.map((k) => (ev.facts as unknown as Record<string, { value: string }>)[k]?.value);

describe("card.minimum_payment", () => {
  it("worked example: 1,000.00 at 24%, minimum max(5%, 100), comparing 500 a month", () => {
    // Minimum: 100 a month until the balance falls below 100.
    //   m1 900 + 18.00; m2 818.00 + 16.36; … clears in month 12; charges 102.16; paid 1,102.16
    // 500 a month: 510.00, 10.20, then 10.20 -> 3 months, 10.20
    const ev = evaluateMinimumPayment(
      minimumPayment({ comparisonPayment: "500.00" }),
      params,
      thresholds,
    );
    expect(
      values(ev, [
        "statementBalance",
        "minimumDue",
        "monthsToClearMinimum",
        "totalInterestMinimum",
        "totalPaidMinimum",
        "minimumClearsBalance",
        "comparisonPayment",
        "monthsToClearComparison",
        "totalInterestComparison",
        "interestSavedComparison",
        "monthsSavedComparison",
      ]),
    ).toEqual([
      "1000.00",
      "100.00",
      "12",
      "102.16",
      "1102.16",
      "true",
      "500.00",
      "3",
      "10.20",
      "91.96",
      "9",
    ]);
    expect(ev.severity).toBe("caution");
    expect(ev.applicable).toBe(true);
    expect(ev.options).toEqual([
      "pay_statement_balance",
      "pay_custom_amount",
      "continue_minimum_payment",
      "talk_to_someone",
    ]);
  });

  it("defaults the comparison to 3 × the minimum (300): 4 months, 24.73", () => {
    // 1,000 − 300 = 700 + 14.00; 414 + 8.28; 122.28 + 2.45; 124.73 -> 24.73
    const ev = evaluateMinimumPayment(minimumPayment(), params, thresholds);
    expect(
      values(ev, ["comparisonPayment", "monthsToClearComparison", "totalInterestComparison"]),
    ).toEqual(["300.00", "4", "24.73"]);
  });

  it("is not applicable when the balance is the minimum", () => {
    const base = minimumPayment();
    const ev = evaluateMinimumPayment(
      { ...base, card: { ...base.card, statementBalance: "80.00" } },
      params,
      thresholds,
    );
    expect(ev.facts.minimumDue.value).toBe("80.00");
    expect(ev.applicable).toBe(false);
  });

  it("reports a minimum that never clears within the horizon", () => {
    // a 1% minimum with no floor never catches up with 2% a month
    const ev = evaluateMinimumPayment(
      minimumPayment(),
      { ...params, minDuePct: "1.00", minDueFloor: "0.00", maxMonths: 24 },
      thresholds,
    );
    expect(ev.facts.minimumClearsBalance.value).toBe("false");
    expect(ev.facts.monthsToClearMinimum.value).toBe("24");
    expect(ev.explanation[0]).toBe("minimum_payment_does_not_clear_balance");
  });

  it("never reports negative savings when the comparison is lower", () => {
    const ev = evaluateMinimumPayment(
      minimumPayment({ comparisonPayment: "100.00" }),
      params,
      thresholds,
    );
    expect(values(ev, ["interestSavedComparison", "monthsSavedComparison"])).toEqual(["0.00", "0"]);
  });
});
