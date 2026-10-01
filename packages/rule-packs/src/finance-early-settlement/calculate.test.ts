import { D, toMoneyString } from "@amil/rules-engine";
import { describe, expect, it } from "vitest";
import { fatimaFinance, financeThresholds, murabahaSchedule, NOW, smallLoan } from "../fixtures";
import { evaluateFinanceEarlySettlement, ibraPct, quoteSettlement } from "./calculate";
import type { FinanceSettlementInput, FinanceSettlementParams } from "./types";

const params: FinanceSettlementParams = {
  horizonDays: 60,
  dayCountBasis: 365,
  roundingMode: "half_up",
  partialPrepaymentAllowed: true,
};
const day = (iso: string) => new Date(`${iso}T00:00:00.000Z`);
const evaluate = (
  input: FinanceSettlementInput,
  now = NOW,
  p: Partial<FinanceSettlementParams> = {},
) => evaluateFinanceEarlySettlement(input, { ...params, ...p }, financeThresholds, now);
const values = (
  input: FinanceSettlementInput,
  now = NOW,
  p: Partial<FinanceSettlementParams> = {},
) =>
  Object.fromEntries(
    Object.entries(evaluate(input, now, p).facts)
      .filter(([k]) => k !== "_sources")
      .map(([k, f]) => [k, (f as { value: string }).value]),
  );
const money = (q: { [k: string]: unknown }, key: string) =>
  toMoneyString(q[key] as ReturnType<typeof D>);

describe("finance.early_settlement: Fatima (murabaha + ibra, flagship, hand-worked)", () => {
  it("computes every fact exactly", () => {
    expect(values(fatimaFinance())).toEqual({
      financeType: "murabaha",
      settlementAmountToday: "101287.50", // 110,075 - 8,787.50
      deferredPriceOutstanding: "110075.00", // 37 x 2,975
      deferredProfitNotYetDue: "17575.00", // 37 x 475
      ibraRebatePct: "50.00", // 11 paid: tier 0
      ibraRebate: "8787.50", // 50% of 17,575
      settlementFee: "0.00",
      arrearsAmount: "0.00",
      coverKind: "takaful",
      coverRefundToday: "1387.50", // 1,800 x 37/48
      netOutflowToday: "99900.00", // 101,287.50 - 1,387.50
      nextInstalmentDate: "2026-10-19",
      nextInstalmentAmount: "2975.00",
      settlementHorizonDays: "60",
      cheapestSettlementDate: "2026-10-19", // instalment 12 paid -> 75% tier
      daysToCheapestDate: "19",
      instalmentsBeforeCheapestDate: "1",
      instalmentsAmountBeforeCheapestDate: "2975.00",
      netOutflowOnCheapestDate: "95900.00", // 2,975 + (107,100 - 12,825) - 1,350
      savingIfSettledOnCheapestDate: "4000.00",
      salaryLinked: "false",
    });
  });

  it("is critical (saving 4,000 >= 1,000) and offers the cheaper date first", () => {
    const ev = evaluate(fatimaFinance());
    expect(ev.applicable).toBe(true);
    expect(ev.severity).toBe("critical");
    expect(ev.options).toEqual([
      "schedule_settlement",
      "partial_prepayment",
      "settle_now",
      "talk_to_someone",
    ]);
    expect(ev.explanation).toEqual(
      expect.arrayContaining([
        "cheaper_settlement_date_within_60_days",
        "ibra_tier_increases_before_cheapest_date",
        "takaful_refund_due",
      ]),
    );
  });

  it.each([
    // date, scheduled instalments paid by then, net outflow
    ["2026-09-30", 0, "99900.00"],
    ["2026-10-18", 0, "99900.00"], // murabaha has no daily accrual: flat until the due date
    ["2026-10-19", 1, "95900.00"],
    ["2026-11-18", 1, "95900.00"],
    // 2 x 2,975 + (35 x 2,975 - 75% x 35 x 475) - 1,800 x 35/48
    //   = 5,950 + (104,125 - 12,468.75) - 1,312.50 = 96,293.75
    ["2026-11-19", 2, "96293.75"],
  ] as const)("quote on %s: %i scheduled, net %s", (date, count, net) => {
    const q = quoteSettlement(fatimaFinance(), params, day("2026-09-30"), day(date));
    expect(q.scheduledCount).toBe(count);
    expect(toMoneyString(q.netOutflow)).toBe(net);
  });

  it("a horizon shorter than 19 days finds no cheaper date", () => {
    const ev = evaluate(fatimaFinance(), NOW, { horizonDays: 18 });
    expect(ev.facts.savingIfSettledOnCheapestDate.value).toBe("0.00");
    expect(ev.facts.cheapestSettlementDate.value).toBe("2026-09-30");
    expect(ev.severity).toBe("info");
    expect(ev.options).toEqual(["partial_prepayment", "settle_now", "talk_to_someone"]);
  });

  it("includes arrears in full and counts only paid instalments for the ibra tier", () => {
    // Instalment 11 (due 2026-09-19) unpaid: 10 paid -> 50% tier; arrears 2,975 owed today.
    const schedule = murabahaSchedule({
      n: 48,
      principal: "2500.00",
      profit: "475.00",
      firstDue: "2025-11-19",
      paid: 11,
      unpaid: [11],
    });
    const v = values(fatimaFinance({ schedule }));
    expect(v.arrearsAmount).toBe("2975.00");
    expect(v.settlementAmountToday).toBe("104262.50"); // 110,075 - 8,787.50 + 2,975
    expect(v.coverRefundToday).toBe("1425.00"); // 1,800 x 38/48 (10 paid)
  });
});

describe("ibraPct tiers", () => {
  const rule = fatimaFinance().finance.rebateRule;
  it.each([
    [0, "50"],
    [11, "50"],
    [12, "75"],
    [47, "75"],
  ] as const)("%i instalments paid -> %s%%", (paid, pct) => {
    expect(ibraPct(rule, paid).toString()).toBe(pct);
  });
  it("no rule or a non-tier rule -> 0", () => {
    expect(ibraPct(null, 20).toString()).toBe("0");
    expect(ibraPct({ type: "future_rental_profit_waived", pct: "100.00" }, 20).toString()).toBe(
      "0",
    );
  });
  it("no tier reached -> 0", () => {
    expect(
      ibraPct(
        {
          type: "ibra_tiers",
          basis: "deferred_profit_not_yet_due",
          tiers: [{ minMonthsElapsed: 6, pct: "40.00" }],
        },
        3,
      ).toString(),
    ).toBe("0");
  });
});

describe("finance.early_settlement: conventional loan (hand-worked, see fixtures)", () => {
  const now = new Date("2026-02-25T10:00:00Z");

  it("today: principal 2,009.93 + 10 days' interest 6.61 + 1% fee 20.10 = 2,036.64", () => {
    // interest = 2,009.93 x 12% x 10/365 = 6.6080 -> 6.61; fee = 1% x 2,009.93 = 20.0993 -> 20.10
    const v = values(smallLoan(), now);
    expect(v).toMatchObject({
      financeType: "conventional",
      outstandingPrincipal: "2009.93",
      accruedInterest: "6.61",
      settlementFee: "20.10",
      settlementFeePct: "1.00",
      settlementAmountToday: "2036.64",
      coverKind: "insurance",
      coverRefundToday: "60.00", // 90 x 2/3
      netOutflowToday: "1976.64",
    });
  });

  it("daily accrual makes today the cheapest date; severity info; no schedule option", () => {
    const ev = evaluate(smallLoan(), now);
    expect(ev.facts.cheapestSettlementDate.value).toBe("2026-02-25");
    expect(ev.facts.savingIfSettledOnCheapestDate.value).toBe("0.00");
    expect(ev.severity).toBe("info");
    expect(ev.options).toEqual(["partial_prepayment", "settle_now", "talk_to_someone"]);
    expect(ev.explanation).toEqual(
      expect.arrayContaining(["settlement_fee_applies", "insurance_refund_due"]),
    );
  });

  it.each([
    // 27 days' interest: 2,009.93 x 12% x 27/365 = 17.8418 -> 17.84; 2,009.93 + 17.84 + 20.10 - 60 = 1,987.87
    ["2026-03-14", "1987.87"],
    // pay #2 (1,020.07); remaining 1,009.96 + fee 10.10, refund 30: 1,020.07 + 1,020.06 - 30 = 2,010.13
    ["2026-03-15", "2010.13"],
    // all paid by 2026-04-15: 2 x instalments, nothing left to settle, no refund
    ["2026-04-15", "2040.13"],
  ] as const)("net outflow if settled on %s = %s", (date, net) => {
    const q = quoteSettlement(smallLoan(), params, day("2026-02-25"), day(date));
    expect(toMoneyString(q.netOutflow)).toBe(net);
  });

  it("nothing left to settle -> no fee and not applicable", () => {
    const loan = smallLoan();
    const allPaid = {
      ...loan.finance,
      schedule: loan.finance.schedule.map((e) => ({ ...e, paid: true })),
    };
    const ev = evaluate({ ...loan, finance: allPaid }, new Date("2026-05-01T00:00:00Z"));
    expect(ev.applicable).toBe(false);
    expect(ev.facts.settlementFee.value).toBe("0.00");
  });

  it("uses the start date for accrual before the first instalment", () => {
    // On 2026-01-25 nothing is paid: 3,000 x 12% x 10/365 = 9.8630 -> 9.86
    const loan = smallLoan();
    const unpaid = {
      ...loan.finance,
      schedule: loan.finance.schedule.map((e) => ({ ...e, paid: false })),
    };
    expect(
      values({ ...loan, finance: unpaid }, new Date("2026-01-25T00:00:00Z")).accruedInterest,
    ).toBe("9.86");
  });

  it("360-day basis: 2,009.93 x 12% x 10/360 = 6.6998 -> 6.70", () => {
    expect(values(smallLoan(), now, { dayCountBasis: 360 }).accruedInterest).toBe("6.70");
  });

  it.each([
    ["cap 15", { type: "pct_of_outstanding", pct: "1.00", cap: "15.00" }, "15.00"],
    ["floor 25", { type: "pct_of_outstanding", pct: "1.00", floor: "25.00" }, "25.00"],
    ["fixed 200", { type: "fixed", amount: "200.00" }, "200.00"],
    ["none", { type: "none" }, "0.00"],
  ] as const)("settlement fee rule %s -> %s", (_name, rule, fee) => {
    const v = values(smallLoan({ settlementFeeRule: rule }), now);
    expect(v.settlementFee).toBe(fee);
    if (rule.type !== "pct_of_outstanding") expect(v.settlementFeePct).toBeUndefined();
  });

  it("no cover -> no cover facts; cover with refund rule none -> refund 0", () => {
    expect(values(smallLoan({ cover: null }), now).coverKind).toBeUndefined();
    const v = values(
      smallLoan({
        cover: {
          kind: "insurance",
          premiumPaid: "90.00",
          coverMonths: "3",
          refundRule: { type: "none" },
        },
      }),
      now,
    );
    expect(v.coverRefundToday).toBe("0.00");
  });

  it("salary-linked finance is at least caution and explains why", () => {
    const ev = evaluate(smallLoan({ salaryLinked: true }), now);
    expect(ev.severity).toBe("caution");
    expect(ev.explanation).toContain("salary_linked_benefits_may_change");
    expect(ev.facts.salaryLinked.value).toBe("true");
  });

  it("partial prepayment option follows the parameter", () => {
    expect(evaluate(smallLoan(), now, { partialPrepaymentAllowed: false }).options).toEqual([
      "settle_now",
      "talk_to_someone",
    ]);
  });
});

describe("finance.early_settlement: ijara", () => {
  it("charges outstanding amount + accrued rental profit; future profit is not charged", () => {
    // Same numbers as the small loan, as an ijara at 12%: accrued 6.61; future profit 20.10 + 10.10 = 30.20
    const v = values(
      smallLoan({
        type: "ijara",
        settlementFeeRule: { type: "none" },
        rebateRule: { type: "future_rental_profit_waived", pct: "100.00" },
      }),
      new Date("2026-02-25T10:00:00Z"),
    );
    expect(v).toMatchObject({
      financeType: "ijara",
      outstandingPrincipal: "2009.93",
      accruedProfit: "6.61",
      futureProfitNotCharged: "30.20",
      settlementFee: "0.00",
      settlementAmountToday: "2016.54",
    });
    expect(v.accruedInterest).toBeUndefined();
  });
});

describe("quote invariants", () => {
  it("net outflow = scheduled payments + settlement - cover refund, on every day of the horizon", () => {
    for (let d = 0; d <= 60; d++) {
      const date = new Date(Date.UTC(2026, 8, 30 + d));
      const q = quoteSettlement(fatimaFinance(), params, day("2026-09-30"), date);
      expect(money(q as never, "netOutflow")).toBe(
        toMoneyString(q.scheduledPayments.plus(q.settlementAmount).minus(q.coverRefund)),
      );
      expect(q.settlementAmount.greaterThanOrEqualTo(D(0))).toBe(true);
    }
  });
});
