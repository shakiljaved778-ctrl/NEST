/** Test fixtures (synthetic). Excluded from coverage. */
import { D, toMoneyString } from "@amil/rules-engine";
import type { CardCloseInput } from "./card-close/types";
import type { FinanceSettlementInput } from "./finance-early-settlement/types";
import type { AccountCloseInput } from "./account-close/pack";
import type { AccountDormancyInput } from "./account-dormancy/pack";
import type { BalanceTransferInput } from "./balance-transfer/pack";
import type { CashWithdrawalInput } from "./cash-withdrawal/pack";
import type { DepositBreakInput } from "./deposit-break/pack";
import type { EppConversionInput } from "./epp-conversion/pack";
import type { MinimumPaymentInput } from "./minimum-payment/pack";
import type { RewardsExpiryInput } from "./rewards-expiry/pack";
import type { ScheduleEntry } from "./rules";
import type { SalaryChangeInput } from "./salary-change/pack";
import type { TopUpInput } from "./top-up/pack";

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

// ── Phase 5 packs ──────────────────────────────────────────────────────────────────────────

/** 1,000.00 cash on a card with 8,000.00 available, 30% APR, fee 3% min 60. */
export function cashWithdrawal(overrides: Partial<CashWithdrawalInput> = {}): CashWithdrawalInput {
  return {
    dataAsOf: day("2026-09-30"),
    card: {
      id: "card_test_cash",
      variant: "conventional",
      balance: "2000.00",
      creditLimit: "10000.00",
      aprPct: "30.0000",
      cashAdvanceFeePct: "3.0000",
      cashAdvanceMinFee: "60.00",
    },
    amount: "1000.00",
    ...overrides,
  };
}

/** 1,000.00 statement at 24% with a 100.00 minimum. */
export function minimumPayment(overrides: Partial<MinimumPaymentInput> = {}): MinimumPaymentInput {
  return {
    dataAsOf: day("2026-09-30"),
    card: {
      id: "card_test_min",
      variant: "conventional",
      statementBalance: "1000.00",
      minDue: "100.00",
      aprPct: "24.0000",
    },
    ...overrides,
  };
}

/** 4,800.00 purchase over 6 months on a 30% card. */
export function eppConversion(overrides: Partial<EppConversionInput> = {}): EppConversionInput {
  return {
    dataAsOf: day("2026-09-30"),
    card: { id: "card_test_epp", variant: "conventional", aprPct: "30.0000" },
    purchase: { amount: "4800.00", transactionId: "txn_test_tv" },
    months: 6,
    ...overrides,
  };
}

export function balanceTransfer(
  overrides: Partial<BalanceTransferInput> = {},
): BalanceTransferInput {
  return {
    dataAsOf: day("2026-09-30"),
    card: { id: "card_test_bt", variant: "conventional", aprPct: "30.0000" },
    amount: "2000.00",
    ...overrides,
  };
}

/** Aisha's term deposit as seeded: 200,000 at 4.25%, 9 days from maturity on NOW. */
export function aishaDeposit(
  overrides: Partial<DepositBreakInput["deposit"]> = {},
): DepositBreakInput {
  return {
    dataAsOf: day("2026-09-30"),
    deposit: {
      id: "dep_aisha_fixed",
      variant: "conventional",
      principal: "200000.00",
      ratePct: "4.2500",
      startAt: day("2025-10-09"),
      maturityAt: day("2026-10-09"),
      breakPenaltyRule: { type: "pct_of_principal", pct: "0.50", min: "250.00" },
      profitOnBreakRule: { type: "reduced_rate", ratePct: "0.2500" },
      ...overrides,
    },
  };
}

export function topUp(overrides: Partial<TopUpInput> = {}): TopUpInput {
  return { ...smallLoan(), topUpAmount: "1000.00", newTenorMonths: 12, ...overrides };
}

/** 12 unpaid level instalments of 1,032.80 on 12,000.00 at 6% (annuity). */
export function levelSchedule(
  principal: string,
  instalment: string,
  months: number,
): ScheduleEntry[] {
  const each = D(principal).dividedBy(months);
  return Array.from({ length: months }, (_, i) => ({
    n: i + 1,
    dueAt: `2026-${String(10 + Math.floor(i / 12)).padStart(2, "0")}-15`,
    principal: toMoneyString(each),
    profitOrInterest: "0.00",
    instalment,
    balanceAfter: "0.00",
    paid: false,
  }));
}

export function salaryChange(overrides: Partial<SalaryChangeInput> = {}): SalaryChangeInput {
  return {
    dataAsOf: day("2026-09-30"),
    variant: "conventional",
    salaryTransfer: true,
    accounts: [
      { id: "acc_test_salary", maintenanceFee: "25.00", maintenanceFeeWaived: true },
      { id: "acc_test_savings", maintenanceFee: "10.00", maintenanceFeeWaived: false },
    ],
    cards: [{ id: "card_test_gold", annualFee: "500.00", annualFeeWaived: true }],
    finances: [
      {
        id: "fin_test_personal",
        type: "conventional",
        ratePct: "6.0000",
        salaryLinked: true,
        schedule: levelSchedule("12000.00", "1032.80", 12),
      },
      {
        id: "fin_test_auto",
        type: "murabaha",
        ratePct: "4.0000",
        salaryLinked: true,
        schedule: levelSchedule("6000.00", "520.00", 12),
      },
      {
        id: "fin_test_unlinked",
        type: "conventional",
        ratePct: "9.0000",
        salaryLinked: false,
        schedule: levelSchedule("3000.00", "262.36", 12),
      },
    ],
    ...overrides,
  };
}

/** Hessa's salary account: cheques outstanding and two standing orders. */
export function accountClose(
  overrides: Partial<AccountCloseInput["account"]> = {},
  extra: Partial<Omit<AccountCloseInput, "account">> = {},
): AccountCloseInput {
  return {
    dataAsOf: day("2026-09-30"),
    account: {
      id: "acc_hessa_current",
      variant: "conventional",
      balance: "14250.00",
      closureFee: "25.00",
      chequesOutstanding: 3,
      isSalaryAccount: true,
      standingOrders: [
        { amount: "450.00", nextRunAt: day("2026-10-20"), active: true },
        { amount: "3500.00", nextRunAt: day("2026-10-05"), active: true },
        { amount: "99.00", nextRunAt: day("2026-10-01"), active: false },
      ],
      ...overrides,
    },
    linkedCards: 1,
    salaryLinkedFinances: 0,
    ...extra,
  };
}

export function dormancy(
  lastActivityDaysAgo: number,
  overrides: Partial<AccountDormancyInput["account"]> = {},
): AccountDormancyInput {
  return {
    dataAsOf: day("2026-09-30"),
    account: {
      id: "acc_test_dormant",
      variant: "conventional",
      balance: "3150.00",
      status: "active",
      lastActivityAt: new Date(day("2026-09-30").getTime() - lastActivityDaysAgo * 86_400_000),
      dormancyDays: 365,
      ...overrides,
    },
  };
}

/** Khalid's rewards as seeded. */
export function rewardsExpiry(
  overrides: Partial<RewardsExpiryInput["rewards"]> = {},
): RewardsExpiryInput {
  return {
    dataAsOf: day("2026-09-30"),
    card: { id: "card_khalid_platinum", variant: "conventional", status: "active" },
    rewards: {
      balance: 42000,
      pointValueQar: "0.0100",
      expiryBuckets: [
        { points: 8000, expiresAt: "2026-11-14" },
        { points: 34000, expiresAt: "2027-11-04" },
      ],
      asOf: day("2026-09-30"),
      ...overrides,
    },
  };
}
