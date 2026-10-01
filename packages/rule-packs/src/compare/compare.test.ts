import type { Fact } from "@amil/rules-engine";
import { describe, expect, it } from "vitest";
import {
  aishaDeposit,
  fatimaFinance,
  financeThresholds,
  minimumPayment,
  NOW,
  smallLoan,
  thresholds,
} from "../fixtures";
import { PACKS } from "../registry";
import {
  compareDepositBreakVsWait,
  compareMinVsCustomPayment,
  compareSettlementTiming,
  type CompareOption,
} from "./compare";

const val = (o: CompareOption | undefined, k: string) => o?.facts[k]?.value;
const settleParams = PACKS["finance.early_settlement"].islamic.defaultParameters;

describe("settlement_timing", () => {
  it("matches finance.early_settlement for Fatima: today vs the cheaper date", () => {
    const input = fatimaFinance();
    const cmp = compareSettlementTiming(input, settleParams, NOW);
    const ev = PACKS["finance.early_settlement"].islamic.evaluate(
      input,
      settleParams,
      financeThresholds,
      NOW,
    );
    const today = cmp.options.find((o) => o.key === "today");
    const cheapest = cmp.options.find((o) => o.key === "cheapest_date");
    expect(val(today, "totalOutflow")).toBe(ev.facts.netOutflowToday.value);
    expect(val(today, "settlementAmount")).toBe(ev.facts.settlementAmountToday.value);
    expect(val(cheapest, "settlementDate")).toBe(ev.facts.cheapestSettlementDate.value);
    expect(val(cheapest, "totalOutflow")).toBe(ev.facts.netOutflowOnCheapestDate.value);
    expect(val(cheapest, "savingVsToday")).toBe(ev.facts.savingIfSettledOnCheapestDate.value);
    expect(val(cheapest, "savingVsToday")).toBe("4000.00");
    expect(cheapest?.best).toBe(true);
    expect(today?.best).toBe(false);
    expect([today?.action, cheapest?.action]).toEqual(["settle_now", "schedule_settlement"]);
    expect((cmp.summary.savingIfSettledOnCheapestDate as Fact).value).toBe("4000.00");
    expect(cmp.applicable).toBe(true);
  });

  it("adds the day after the next instalment when it is a different date in the horizon", () => {
    const input = fatimaFinance();
    const cmp = compareSettlementTiming(input, settleParams, NOW);
    const after = cmp.options.find((o) => o.key === "after_next_instalment");
    const ev = PACKS["finance.early_settlement"].islamic.evaluate(
      input,
      settleParams,
      financeThresholds,
      NOW,
    );
    if (after) {
      const next = new Date(`${ev.facts.nextInstalmentDate.value}T00:00:00Z`);
      next.setUTCDate(next.getUTCDate() + 1);
      expect(val(after, "settlementDate")).toBe(next.toISOString().slice(0, 10));
      expect(
        Number(val(after, "savingVsToday")) + Number(val(after, "extraVsToday")),
      ).toBeGreaterThanOrEqual(0);
    }
    // Options are distinct dates.
    const dates = cmp.options.map((o) => val(o, "settlementDate"));
    expect(new Set(dates).size).toBe(dates.length);
  });

  it("leaves out a date beyond the horizon", () => {
    const params = {
      ...PACKS["finance.early_settlement"].conventional.defaultParameters,
      horizonDays: 3,
    };
    const cmp = compareSettlementTiming(smallLoan(), params, new Date("2026-02-25T10:00:00Z"));
    // next instalment 15 March + 1 day is after 28 February
    expect(cmp.options.map((o) => o.key)).toEqual(["today"]);
  });

  it("when today is cheapest, today is the only option marked best and nothing is saved", () => {
    // The small conventional loan with a 1% fee: settling later only adds interest.
    const params = PACKS["finance.early_settlement"].conventional.defaultParameters;
    const cmp = compareSettlementTiming(smallLoan(), params, new Date("2026-02-25T10:00:00Z"));
    const today = cmp.options[0];
    expect(today?.key).toBe("today");
    expect(today?.best).toBe(true);
    expect(cmp.options.filter((o) => o.best)).toHaveLength(1);
    for (const o of cmp.options) expect(val(o, "savingVsToday")).toBe("0.00");
  });

  it("is not applicable once every instalment is paid", () => {
    const base = smallLoan();
    const paid = {
      ...base,
      finance: {
        ...base.finance,
        schedule: base.finance.schedule.map((e) => ({ ...e, paid: true })),
      },
    };
    const params = PACKS["finance.early_settlement"].conventional.defaultParameters;
    expect(compareSettlementTiming(paid, params, new Date("2026-02-25T10:00:00Z")).applicable).toBe(
      false,
    );
  });
});

describe("min_vs_custom_payment", () => {
  const params = PACKS["card.minimum_payment"].conventional.defaultParameters;

  it("minimum vs 500 a month vs in full, matching card.minimum_payment", () => {
    // minimum: 12 months, 102.16 charges, 1,102.16 paid; 500/month: 3 months, 10.20; full: 0.00
    const input = minimumPayment({ comparisonPayment: "500.00" });
    const cmp = compareMinVsCustomPayment(input, params);
    const ev = PACKS["card.minimum_payment"].conventional.evaluate(input, params, thresholds, NOW);
    const [min, custom, full] = cmp.options;
    expect([
      val(min, "monthlyPayment"),
      val(min, "monthsToClear"),
      val(min, "totalCharges"),
      val(min, "totalPaid"),
    ]).toEqual([
      ev.facts.minimumDue.value,
      ev.facts.monthsToClearMinimum.value,
      ev.facts.totalInterestMinimum.value,
      ev.facts.totalPaidMinimum.value,
    ]);
    expect([val(min, "monthsToClear"), val(min, "totalCharges")]).toEqual(["12", "102.16"]);
    expect([
      val(custom, "monthlyPayment"),
      val(custom, "monthsToClear"),
      val(custom, "totalCharges"),
      val(custom, "totalPaid"),
    ]).toEqual(["500.00", "3", "10.20", "1010.20"]);
    expect([
      val(full, "monthlyPayment"),
      val(full, "monthsToClear"),
      val(full, "totalCharges"),
      val(full, "totalPaid"),
    ]).toEqual(["1000.00", "1", "0.00", "1000.00"]);
    expect(cmp.options.map((o) => [o.key, o.best, o.action])).toEqual([
      ["minimum", false, "continue_minimum_payment"],
      ["custom", false, "pay_custom_amount"],
      ["full", true, "pay_statement_balance"],
    ]);
    expect(cmp.applicable).toBe(true);
  });

  it("defaults the custom amount to the pack's multiple of the minimum", () => {
    const cmp = compareMinVsCustomPayment(minimumPayment(), params);
    expect(val(cmp.options[1], "monthlyPayment")).toBe("300.00");
  });
});

describe("deposit_break_vs_wait", () => {
  const params = PACKS["deposit.break"].conventional.defaultParameters;

  it("Aisha: break today vs keep to maturity, matching deposit.break", () => {
    const cmp = compareDepositBreakVsWait(aishaDeposit(), params, NOW);
    const [now, wait] = cmp.options;
    expect([
      val(now, "receiveDate"),
      val(now, "amountReceived"),
      val(now, "returnEarned"),
      val(now, "penalty"),
    ]).toEqual(["2026-09-30", "199487.67", "487.67", "1000.00"]);
    expect([
      val(wait, "receiveDate"),
      val(wait, "amountReceived"),
      val(wait, "returnEarned"),
      val(wait, "penalty"),
    ]).toEqual(["2026-10-09", "208500.00", "8500.00", "0.00"]);
    expect([now?.best, wait?.best]).toEqual([false, true]);
    expect((cmp.summary.differenceIfKeptToMaturity as Fact).value).toBe("9012.33");
  });
});
