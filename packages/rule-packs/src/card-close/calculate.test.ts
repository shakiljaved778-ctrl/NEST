import { describe, expect, it } from "vitest";
import { emptyCard, khalidCard, NOW, thresholds } from "../fixtures";
import type { CardCloseInput, CardCloseParams } from "./types";
import { evaluateCardClose } from "./calculate";

const params: CardCloseParams = {
  pointsExpiryWindowDays: 90,
  pendingCashbackOnClosure: "forfeited",
  programmePointValueQar: null,
  roundingMode: "half_up",
};
const day = (iso: string) => new Date(`${iso}T00:00:00.000Z`);
const evalCard = (input: CardCloseInput, p: Partial<CardCloseParams> = {}) =>
  evaluateCardClose(input, { ...params, ...p }, thresholds, NOW);
const values = (input: CardCloseInput, p: Partial<CardCloseParams> = {}) =>
  Object.fromEntries(
    Object.entries(evalCard(input, p).facts)
      .filter(([k]) => k !== "_sources")
      .map(([k, f]) => [k, (f as { value: string }).value]),
  );

describe("card.close: Khalid (flagship, hand-worked)", () => {
  const ev = evalCard(khalidCard());

  it("computes every fact exactly", () => {
    expect(values(khalidCard())).toEqual({
      pointsBalance: "42000",
      pointValueQar: "0.0100",
      pointsValue: "420.00", // 42,000 x 0.01
      pointsExpiringSoon: "8000", // bucket expiring 2026-11-14 (day 45)
      pointsExpiringSoonValue: "80.00",
      nextPointsExpiryDate: "2026-11-14",
      pointsExpiryWindowDays: "90",
      pendingCashback: "0.00",
      pendingCashbackForfeited: "0.00",
      forfeitedValue: "420.00",
      activeInstalmentPlans: "1",
      instalmentsRemainingPrincipal: "3600.00",
      instalmentEarlyClosureFees: "72.00", // 2% of 3,600 = 72 (> min 50)
      instalmentsPayableOnClosure: "3672.00",
      annualFee: "1500.00",
      annualFeeRefundEligible: "true",
      annualFeeMonthsUsed: "2", // charged 2026-07-30
      annualFeeRefund: "1250.00", // 1,500 x 10/12
      supplementaryCards: "1",
      outstandingBalance: "6250.00",
      netAmountToClear: "8672.00", // 6,250 + 3,672 - 1,250
      avoidableLoss: "492.00", // 420 + 72
    });
  });

  it("is critical, applicable, and offers redeem points first", () => {
    expect(ev.applicable).toBe(true);
    expect(ev.severity).toBe("critical");
    expect(ev.options).toEqual([
      "redeem_points",
      "view_instalments",
      "continue_closure",
      "talk_to_someone",
    ]);
    expect(ev.explanation).toContain("points_forfeited_on_closure");
    expect(ev.explanation).toContain("points_expiring_within_90_days");
    expect(ev.explanation).toContain("severity_basis_qar:492.00");
  });

  it("cites a source and as-of date for every fact", () => {
    for (const [k, f] of Object.entries(ev.facts)) {
      if (k === "_sources") continue;
      expect(f).toMatchObject({ key: k, asOf: "2026-09-30" });
    }
    expect(ev.facts._sources.map((s) => s.source).sort()).toEqual(
      ["card", "computed", "instalment_plan", "rewards_ledger", "rule_pack"].sort(),
    );
  });
});

describe("card.close: the bank's programme point value (console parameter)", () => {
  it("replaces the ledger's value when set: 42,000 × 0.0125 = 525.00", () => {
    const ev = evalCard(khalidCard(), { programmePointValueQar: "0.0125" });
    expect([
      ev.facts.pointValueQar.value,
      ev.facts.pointValueQar.source,
      ev.facts.pointsValue.value,
    ]).toEqual(["0.0125", "rule_pack", "525.00"]);
    // 8,000 expiring × 0.0125 = 100.00
    expect(ev.facts.pointsExpiringSoonValue.value).toBe("100.00");
  });

  it("keeps the ledger's value when not set", () => {
    const ev = evalCard(khalidCard());
    expect([ev.facts.pointValueQar.value, ev.facts.pointValueQar.source]).toEqual([
      "0.0100",
      "rewards_ledger",
    ]);
  });
});

describe("card.close: severity from avoidable loss (caution 50, critical 250)", () => {
  const withPoints = (balance: number, pendingCashback = "0.00"): CardCloseInput => {
    const base = emptyCard();
    return {
      ...base,
      rewards: {
        balance,
        pointValueQar: "0.0100",
        expiryBuckets: [],
        pendingCashback,
        asOf: day("2026-09-30"),
      },
    };
  };
  it.each([
    [2000, "0.00", "info"], // 20.00
    [5000, "0.00", "caution"], // 50.00, inclusive
    [24999, "0.00", "caution"], // 249.99
    [25000, "0.00", "critical"], // 250.00
    [0, "60.00", "caution"], // cashback only
    [20000, "50.00", "critical"], // 200 + 50 = 250
  ] as const)("%i points + %s cashback -> %s", (points, cashback, severity) => {
    const ev = evalCard(withPoints(points, cashback));
    expect(ev.severity).toBe(severity);
    expect(ev.applicable).toBe(true);
  });

  it("credited cashback is not forfeited and does not raise severity", () => {
    const v = values(withPoints(0, "60.00"), { pendingCashbackOnClosure: "credited" });
    expect(v.pendingCashbackForfeited).toBe("0.00");
    expect(v.forfeitedValue).toBe("0.00");
    expect(
      evalCard(withPoints(0, "60.00"), { pendingCashbackOnClosure: "credited" }).severity,
    ).toBe("info");
  });
});

describe("card.close: applicability and options", () => {
  it("nothing at stake -> not applicable, info, just continue + talk", () => {
    const ev = evalCard(emptyCard());
    expect(ev.applicable).toBe(false);
    expect(ev.severity).toBe("info");
    expect(ev.options).toEqual(["continue_closure", "talk_to_someone"]);
  });

  it.each([
    ["outstanding balance only", { balance: "10.00" }],
    ["supplementary card only", { supplementaryCount: 1 }],
  ] as const)("%s -> applicable", (_name, cardPatch) => {
    const base = emptyCard();
    expect(evalCard({ ...base, card: { ...base.card, ...cardPatch } }).applicable).toBe(true);
  });

  it("plans with nothing remaining are ignored", () => {
    const base = khalidCard();
    const plan = base.instalmentPlans[0];
    if (!plan) throw new Error("fixture");
    const v = values({ ...base, instalmentPlans: [{ ...plan, principalRemaining: "0.00" }] });
    expect(v.activeInstalmentPlans).toBe("0");
    expect(v.instalmentsPayableOnClosure).toBe("0.00");
  });
});

describe("card.close: points expiry window (90 days from 2026-09-30 = 2026-12-29)", () => {
  it.each([
    ["2026-09-29", 0], // already expired yesterday: not counted
    ["2026-09-30", 100], // today: counted
    ["2026-12-29", 100], // day 90: counted (inclusive)
    ["2026-12-30", 0], // day 91: outside the window
  ] as const)("bucket expiring %s -> %i points", (expiresAt, expected) => {
    const base = khalidCard();
    const input: CardCloseInput = {
      ...base,
      rewards: {
        balance: 100,
        pointValueQar: "0.0100",
        expiryBuckets: [{ points: 100, expiresAt }],
        pendingCashback: "0.00",
        asOf: day("2026-09-30"),
      },
    };
    expect(values(input).pointsExpiringSoon).toBe(String(expected));
  });

  it("a shorter window parameter excludes Khalid's day-45 bucket", () => {
    expect(values(khalidCard(), { pointsExpiryWindowDays: 30 }).pointsExpiringSoon).toBe("0");
  });
});

describe("card.close: annual fee refund (pro-rata, started months count as used)", () => {
  const withFee = (chargedAt: string | null, patch: Partial<CardCloseInput["card"]> = {}) => {
    const base = khalidCard();
    return {
      ...base,
      card: { ...base.card, annualFeeChargedAt: chargedAt ? day(chargedAt) : null, ...patch },
    };
  };
  it.each([
    ["2026-09-30", "0", "1500.00"], // charged today: 0 months used -> full refund
    ["2026-09-29", "1", "1375.00"], // 1 day ago: month 1 started -> 1,500 x 11/12
    ["2026-07-30", "2", "1250.00"], // exactly 2 months -> 1,500 x 10/12
    ["2026-07-29", "3", "1125.00"], // 2 months + 1 day -> 3 started
    ["2025-10-01", "12", "0.00"], // 11 months 29 days -> 12 started -> nothing left
    ["2025-09-30", "12", "0.00"], // exactly 12 months -> cycle complete
  ] as const)("charged %s -> %s months used, refund %s", (chargedAt, months, refund) => {
    const v = values(withFee(chargedAt));
    expect(v.annualFeeMonthsUsed).toBe(months);
    expect(v.annualFeeRefund).toBe(refund);
    expect(v.annualFeeRefundEligible).toBe(refund === "0.00" ? "false" : "true");
  });

  it.each([
    ["waived", withFee("2026-07-30", { annualFeeWaived: true })],
    ["no refund rule", withFee("2026-07-30", { feeRefundRule: { type: "none" } })],
    ["zero fee", withFee("2026-07-30", { annualFee: "0.00" })],
    ["never charged", withFee(null)],
  ] as const)("%s -> no refund", (_name, input) => {
    expect(values(input).annualFeeRefund).toBe("0.00");
    expect(values(input).annualFeeRefundEligible).toBe("false");
  });

  it("a refund larger than everything owed leaves nothing to clear (never negative)", () => {
    const base = withFee("2026-09-30", { balance: "100.00" });
    expect(values({ ...base, instalmentPlans: [] }).netAmountToClear).toBe("0.00"); // 100 - 1,500 -> 0
  });
});

describe("card.close: instalment early-closure fee rules", () => {
  const withRule = (
    remaining: string,
    rule: CardCloseInput["instalmentPlans"][number]["earlyClosureFeeRule"],
  ) => {
    const base = khalidCard();
    return {
      ...base,
      instalmentPlans: [
        {
          id: "p",
          principalRemaining: remaining,
          monthsRemaining: 3,
          monthlyAmount: "1.00",
          earlyClosureFeeRule: rule,
        },
      ],
    };
  };
  it.each([
    ["none", "3600.00", { type: "none" }, "0.00"],
    ["fixed 100", "3600.00", { type: "fixed", amount: "100.00" }, "100.00"],
    [
      "2% of 3,600 = 72 (above min 50)",
      "3600.00",
      { type: "pct_of_remaining", pct: "2.00", min: "50.00" },
      "72.00",
    ],
    [
      "2% of 1,000 = 20 -> min 50",
      "1000.00",
      { type: "pct_of_remaining", pct: "2.00", min: "50.00" },
      "50.00",
    ],
    [
      "2% of 10,000 = 200 -> max 150",
      "10000.00",
      { type: "pct_of_remaining", pct: "2.00", max: "150.00" },
      "150.00",
    ],
    [
      "1.5% of 1,234.50 = 18.5175 -> 18.52",
      "1234.50",
      { type: "pct_of_remaining", pct: "1.50" },
      "18.52",
    ],
  ] as const)("%s", (_name, remaining, rule, fee) => {
    expect(values(withRule(remaining, rule)).instalmentEarlyClosureFees).toBe(fee);
  });

  it("sums across several plans", () => {
    const base = khalidCard();
    const v = values({
      ...base,
      instalmentPlans: [
        {
          id: "a",
          principalRemaining: "1000.00",
          monthsRemaining: 2,
          monthlyAmount: "500.00",
          earlyClosureFeeRule: { type: "fixed", amount: "25.00" },
        },
        {
          id: "b",
          principalRemaining: "2000.00",
          monthsRemaining: 4,
          monthlyAmount: "500.00",
          earlyClosureFeeRule: { type: "fixed", amount: "40.00" },
        },
      ],
    });
    expect(v).toMatchObject({
      activeInstalmentPlans: "2",
      instalmentsRemainingPrincipal: "3000.00",
      instalmentEarlyClosureFees: "65.00",
      instalmentsPayableOnClosure: "3065.00",
    });
  });
});

describe("card.close: rounding mode parameter", () => {
  // 12,345 points x 0.0050 = 61.725 -> half_up 61.73, half_even 61.72
  const input = (): CardCloseInput => ({
    ...emptyCard(),
    rewards: {
      balance: 12345,
      pointValueQar: "0.0050",
      expiryBuckets: [],
      pendingCashback: "0.00",
      asOf: day("2026-09-30"),
    },
  });
  it.each([
    ["half_up", "61.73"],
    ["half_even", "61.72"],
  ] as const)("%s -> %s", (roundingMode, expected) => {
    expect(values(input(), { roundingMode }).pointsValue).toBe(expected);
  });
});
