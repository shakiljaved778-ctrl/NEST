/** Test fixtures (synthetic). Excluded from coverage. */
import { D, toMoneyString } from "@amil/rules-engine";
import type { CardCloseInput } from "./card-close/types";
import type { FinanceSettlementInput } from "./finance-early-settlement/types";
import type { ScheduleEntry } from "./rules";

export const NOW = new Date("2026-09-30T09:00:00Z");
export const thresholds = { cautionAtQar: "50.00", criticalAtQar: "250.00" };
export const financeThresholds = { cautionAtQar: "100.00", criticalAtQar: "1000.00" };

const day = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

/** Khalid's card as seeded (see packages/db/src/seed/customers.ts). */
export function khalidCard(overrides: Partial<CardCloseInput> = {}): CardCloseInput {
  return {
    dataAsOf: day("2026-09-30"),
    card: {
      id: "card_khalid_platinum",
      variant: "conventional",
      balance: "6250.00",
      annualFee: "1500.00",
      annualFeeChargedAt: day("2026-07-30"),
      annualFeeWaived: false,
      feeRefundRule: { type: "pro_rata_months", withinMonths: "12" },
      supplementaryCount: 1,
    },
    rewards: {
      balance: 42000,
      pointValueQar: "0.0100",
      expiryBuckets: [
        { points: 8000, expiresAt: "2026-11-14" },
        { points: 34000, expiresAt: "2027-11-04" },
      ],
      pendingCashback: "0.00",
      asOf: day("2026-09-30"),
    },
    instalmentPlans: [
      {
        id: "epp_khalid_laptop",
        principalRemaining: "3600.00",
        monthsRemaining: 6,
        monthlyAmount: "600.00",
        earlyClosureFeeRule: { type: "pct_of_remaining", pct: "2.00", min: "50.00" },
      },
    ],
    ...overrides,
  };
}

/** A card with nothing at stake: no rewards, no balance, no plans, no supplementary cards. */
export function emptyCard(): CardCloseInput {
  const base = khalidCard();
  return {
    ...base,
    card: {
      ...base.card,
      balance: "0.00",
      annualFee: "0.00",
      annualFeeChargedAt: null,
      supplementaryCount: 0,
    },
    rewards: null,
    instalmentPlans: [],
  };
}

/**
 * Murabaha schedule: n instalments of principal + profit, monthly from firstDue,
 * the first `paid` of them paid. Matches the seed's flat-profit murabaha.
 */
export function murabahaSchedule(opts: {
  n: number;
  principal: string;
  profit: string;
  firstDue: string;
  paid: number;
  unpaid?: number[];
}): ScheduleEntry[] {
  const entries: ScheduleEntry[] = [];
  const first = day(opts.firstDue);
  for (let k = 1; k <= opts.n; k++) {
    const due = new Date(
      Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + k - 1, first.getUTCDate()),
    );
    entries.push({
      n: k,
      dueAt: due.toISOString().slice(0, 10),
      principal: opts.principal,
      profitOrInterest: opts.profit,
      instalment: toMoneyString(D(opts.principal).plus(D(opts.profit))),
      balanceAfter: "0.00",
      paid: k <= opts.paid && !(opts.unpaid ?? []).includes(k),
    });
  }
  return entries;
}

/** Fatima's murabaha as seeded: 120,000 at 4.75% flat over 48 months; 11 paid; next due 2026-10-19. */
export function fatimaFinance(
  overrides: Partial<FinanceSettlementInput["finance"]> = {},
): FinanceSettlementInput {
  return {
    dataAsOf: day("2026-09-30"),
    finance: {
      id: "fin_fatima_murabaha",
      type: "murabaha",
      ratePct: "4.7500",
      tenorMonths: 48,
      startAt: day("2025-10-19"),
      schedule: murabahaSchedule({
        n: 48,
        principal: "2500.00",
        profit: "475.00",
        firstDue: "2025-11-19",
        paid: 11,
      }),
      settlementFeeRule: { type: "none" },
      rebateRule: {
        type: "ibra_tiers",
        basis: "deferred_profit_not_yet_due",
        tiers: [
          { minMonthsElapsed: 0, pct: "50.00" },
          { minMonthsElapsed: 12, pct: "75.00" },
        ],
      },
      cover: {
        kind: "takaful",
        premiumPaid: "1800.00",
        coverMonths: "48",
        refundRule: { type: "pro_rata_months_unexpired" },
      },
      salaryLinked: false,
      ...overrides,
    },
  };
}

/**
 * Small conventional loan, hand-worked: 3,000 at 12% p.a. over 3 months, r = 1% a month.
 *   instalment = 3,000 x 0.01 / (1 - 1.01^-3) = 1,020.0663 -> 1,020.07
 *   #1 2026-02-15: interest 30.00, principal  990.07, balance 2,009.93
 *   #2 2026-03-15: interest 20.10, principal  999.97, balance 1,009.96
 *   #3 2026-04-15: interest 10.10, principal 1,009.96, balance 0.00 (instalment 1,020.06)
 */
export function smallLoan(
  overrides: Partial<FinanceSettlementInput["finance"]> = {},
): FinanceSettlementInput {
  return {
    dataAsOf: day("2026-02-25"),
    finance: {
      id: "fin_test_small",
      type: "conventional",
      ratePct: "12.0000",
      tenorMonths: 3,
      startAt: day("2026-01-15"),
      schedule: [
        {
          n: 1,
          dueAt: "2026-02-15",
          principal: "990.07",
          profitOrInterest: "30.00",
          instalment: "1020.07",
          balanceAfter: "2009.93",
          paid: true,
        },
        {
          n: 2,
          dueAt: "2026-03-15",
          principal: "999.97",
          profitOrInterest: "20.10",
          instalment: "1020.07",
          balanceAfter: "1009.96",
          paid: false,
        },
        {
          n: 3,
          dueAt: "2026-04-15",
          principal: "1009.96",
          profitOrInterest: "10.10",
          instalment: "1020.06",
          balanceAfter: "0.00",
          paid: false,
        },
      ],
      settlementFeeRule: {
        type: "pct_of_outstanding",
        pct: "1.00",
        cap: "10000.00",
        floor: "0.00",
      },
      rebateRule: null,
      cover: {
        kind: "insurance",
        premiumPaid: "90.00",
        coverMonths: "3",
        refundRule: { type: "pro_rata_months_unexpired" },
      },
      salaryLinked: false,
      ...overrides,
    },
  };
}
