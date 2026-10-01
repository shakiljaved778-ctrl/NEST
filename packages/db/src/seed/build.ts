/**
 * Pure builder for the synthetic Doha Demo Bank dataset: `buildSeedData(now)` returns plain
 * rows ready for Prisma `createMany`. There is no I/O here, so it can be unit tested with a
 * fixed `now`.
 *
 * ALL VALUES ARE SYNTHETIC DEMO DATA. Doha Demo Bank is fictional.
 */
import type { Prisma } from "@prisma/client";
import {
  addDays,
  addMonths,
  D,
  isoDate,
  max,
  min,
  percentOf,
  round,
  startOfUtcDay,
  toFixedString,
  toMoneyString,
  type Dec,
} from "@amil/rules-engine";
import { ALL_PACK_DEFINITIONS, TEMPLATES } from "@amil/rule-packs";
import { bank, BANK_ID, consoleUsers, proactiveJobs } from "./bank";
import { customers, type CardSpec, type CustomerSpec, type FinanceSpec } from "./customers";
import { FEE_AMOUNTS, FEE_CODES, feeSchedule } from "./fees";
import { hashSeed, Rng } from "./rng";

export const SEED_VERSION = "1.0.0";
export const HISTORY_MONTHS = 6;
export const NAMED_PERSONAS = ["khalid", "fatima", "ravi", "aisha", "omar"] as const;

// Synthetic product rules (money/rates as strings, D-004) ---------------------------------------

export const RULES = {
  cardFeeRefundProRata: { type: "pro_rata_months", withinMonths: "12" },
  cardFeeRefundNone: { type: "none" },
  eppEarlyClosure: { type: "pct_of_remaining", pct: "2.00", min: "50.00" },
  convSettlementFee: { type: "pct_of_outstanding", pct: "1.00", cap: "10000.00", floor: "0.00" },
  islamicSettlementFee: { type: "none" },
  murabahaIbra: {
    type: "ibra_tiers",
    basis: "deferred_profit_not_yet_due",
    tiers: [
      { minMonthsElapsed: 0, pct: "50.00" },
      { minMonthsElapsed: 12, pct: "75.00" },
    ],
  },
  ijaraRebate: { type: "future_rental_profit_waived", pct: "100.00" },
  coverRefund: { type: "pro_rata_months_unexpired" },
  convDepositPenalty: { type: "pct_of_principal", pct: "0.50", min: "250.00" },
  convDepositProfitOnBreak: { type: "reduced_rate", ratePct: "0.2500" },
  islamicDepositPenalty: { type: "none" },
  islamicDepositProfitOnBreak: { type: "reduced_rate", ratePct: "1.0000" },
} as const;

export const MIN_DUE_PCT = "5.00";
export const MIN_DUE_FLOOR = "100.00";

/** Synthetic minimum-due formula: max(5% of statement balance, QAR 100), never above the balance. */
export function minimumDue(statementBalance: Dec): Dec {
  if (statementBalance.lessThanOrEqualTo(0)) return D(0);
  return round(
    min(max(percentOf(statementBalance, D(MIN_DUE_PCT)), D(MIN_DUE_FLOOR)), statementBalance),
  );
}

export interface ScheduleEntry {
  n: number;
  dueAt: string;
  principal: string;
  profitOrInterest: string;
  instalment: string;
  balanceAfter: string;
  paid: boolean;
}

/**
 * Repayment schedule.
 * - conventional / ijara: reducing-balance annuity, r = rate / 12 / 100,
 *   instalment = P·r / (1 − (1+r)^−n), with interest (or rental profit) on the opening balance.
 * - murabaha: flat profit = P × rate × n/12 fixed at inception, spread evenly; the sale price is
 *   P + profit.
 * The last instalment absorbs rounding so that principal sums to P exactly.
 */
export function buildSchedule(
  spec: Pick<
    FinanceSpec,
    "type" | "originalPrincipal" | "ratePct" | "tenorMonths" | "monthsElapsed"
  >,
  firstDueAt: Date,
): ScheduleEntry[] {
  const P = D(spec.originalPrincipal);
  const n = spec.tenorMonths;
  const entries: ScheduleEntry[] = [];
  let balance = P;

  if (spec.type === "murabaha") {
    const totalProfit = round(P.times(D(spec.ratePct)).dividedBy(100).times(n).dividedBy(12));
    const instalment = round(P.plus(totalProfit).dividedBy(n));
    const principalK = round(P.dividedBy(n));
    let profitLeft = totalProfit;
    for (let k = 1; k <= n; k++) {
      const last = k === n;
      const principal = last ? balance : principalK;
      const profit = last ? profitLeft : instalment.minus(principalK);
      balance = balance.minus(principal);
      profitLeft = profitLeft.minus(profit);
      entries.push(entry(k, principal, profit, balance));
    }
  } else {
    const r = D(spec.ratePct).dividedBy(1200);
    const instalment = round(P.times(r).dividedBy(D(1).minus(r.plus(1).pow(-n))));
    for (let k = 1; k <= n; k++) {
      const charge = round(balance.times(r));
      const principal = k === n ? balance : instalment.minus(charge);
      balance = balance.minus(principal);
      entries.push(entry(k, principal, charge, balance));
    }
  }
  return entries;

  function entry(k: number, principal: Dec, charge: Dec, after: Dec): ScheduleEntry {
    return {
      n: k,
      dueAt: isoDate(addMonths(firstDueAt, k - 1)),
      principal: toMoneyString(principal),
      profitOrInterest: toMoneyString(charge),
      instalment: toMoneyString(principal.plus(charge)),
      balanceAfter: toMoneyString(after),
      paid: k <= spec.monthsElapsed,
    };
  }
}

function pad(n: number, width: number): string {
  return String(n).padStart(width, "0");
}

/** Luhn check, used to guarantee synthetic PANs are NOT valid card numbers. */
export function isLuhnValid(digits: string): boolean {
  let sum = 0;
  let double = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let d = Number(digits[i]);
    if (double) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
    double = !double;
  }
  return sum % 10 === 0;
}

function syntheticPan(customerIdx: number, cardIdx: number): string {
  let pan = `0000${pad(customerIdx, 4)}${pad(cardIdx, 4)}${pad((customerIdx * 7 + cardIdx) % 10000, 4)}`;
  if (isLuhnValid(pan)) pan = pan.slice(0, 15) + String((Number(pan[15]) + 1) % 10);
  return pan;
}

export interface SeedData {
  now: Date;
  bank: Prisma.BankCreateInput;
  consoleUsers: Prisma.ConsoleUserCreateManyInput[];
  proactiveJobs: Prisma.ProactiveJobCreateManyInput[];
  feeSchedule: Prisma.FeeScheduleCreateManyInput[];
  customers: Prisma.CustomerCreateManyInput[];
  consents: Prisma.ConsentCreateManyInput[];
  accounts: Prisma.AccountCreateManyInput[];
  standingOrders: Prisma.StandingOrderCreateManyInput[];
  cards: Prisma.CardCreateManyInput[];
  rewardsLedgers: Prisma.RewardsLedgerCreateManyInput[];
  instalmentPlans: Prisma.InstalmentPlanCreateManyInput[];
  finances: Prisma.FinanceCreateManyInput[];
  deposits: Prisma.DepositCreateManyInput[];
  transactions: Prisma.TransactionCreateManyInput[];
  rulePacks: Prisma.RulePackCreateManyInput[];
  templates: Prisma.TemplateCreateManyInput[];
}

type TxnInput = Omit<Prisma.TransactionCreateManyInput, "id">;

const MERCHANTS: Record<string, readonly string[]> = {
  groceries: ["Pearl Grocers (demo)", "Al Sadd Fresh Market (demo)", "Corniche Hypermarket (demo)"],
  dining: ["Katara Dining House (demo)", "Corniche Coffee (demo)", "Souq Grill (demo)"],
  fuel: ["Lusail Fuel Station (demo)", "Al Rayyan Fuel (demo)"],
  shopping: ["Msheireb Fashion (demo)", "West Bay Books (demo)", "Villaggio Style (demo)"],
  health: ["Al Sadd Pharmacy (demo)", "Aspire Clinic (demo)"],
  entertainment: ["Doha Cinema Club (demo)", "Aspire Sports Park (demo)"],
  telecom: ["Qatar Mobile (demo)"],
};
const FOREIGN_MERCHANTS = [
  "London Department Store (demo, abroad)",
  "Dubai Mall Retail (demo, abroad)",
  "Online Marketplace USD (demo, abroad)",
];
const BILLS = ["Doha Utilities (demo)", "Home Internet (demo)", "Qatar Mobile (demo)"];

const SPEND_PROFILE = {
  low: { perMonth: [6, 10], minQar: 15, maxQar: 300 },
  mid: { perMonth: [12, 18], minQar: 20, maxQar: 650 },
  high: { perMonth: [18, 28], minQar: 30, maxQar: 1600 },
} as const;

/** Build the whole dataset for a given `now`. Deterministic: same `now` gives the same output. */
export function buildSeedData(now: Date): SeedData {
  const N = startOfUtcDay(now);
  const windowStart = addMonths(N, -HISTORY_MONTHS);

  const data: SeedData = {
    now,
    bank: {
      ...bank,
      supportedLocales: [...bank.supportedLocales],
    },
    consoleUsers: consoleUsers.map((u) => ({ ...u, bankId: BANK_ID })),
    proactiveJobs: proactiveJobs.map((j) => ({ ...j, bankId: BANK_ID })),
    feeSchedule: feeSchedule.map((f) => ({
      ...f,
      bankId: BANK_ID,
      version: 1,
      effectiveFrom: addMonths(N, -24),
    })),
    customers: [],
    consents: [],
    accounts: [],
    standingOrders: [],
    cards: [],
    rewardsLedgers: [],
    instalmentPlans: [],
    finances: [],
    deposits: [],
    transactions: [],
    // Implemented packs with their versioned default parameters (Phase 2: the two flagships).
    rulePacks: ALL_PACK_DEFINITIONS.map((d) => ({
      id: `rp_${d.key}_${d.variant}_${d.version}`,
      bankId: BANK_ID,
      key: d.key,
      version: d.version,
      variant: d.variant,
      productFamily: d.productFamily,
      status: "active",
      enabled: true,
      parameters: d.parameters as Prisma.InputJsonValue,
      effectiveFrom: addDays(N, -30),
      createdBy: "cu_product",
    })),
    // Bank-approved demo copy (non-negotiable 8): Islamic packs carry sharia_approved.
    templates: TEMPLATES.map((t) => {
      const islamic = t.variant === "islamic";
      return {
        id: `tpl_${t.key}_${t.locale}_v${t.version}`,
        bankId: BANK_ID,
        key: t.key,
        rulePackKey: t.rulePackKey,
        variant: t.variant,
        locale: t.locale,
        severity: t.severity,
        headline: t.headline,
        body: t.body,
        options: t.options,
        status: islamic ? "sharia_approved" : "approved",
        version: t.version,
        approvedBy: islamic ? "cu_sharia" : "cu_compliance",
        approvedAt: addDays(N, -30),
        enabled: true,
      };
    }),
  };

  customers.forEach((spec, i) => buildCustomer(data, spec, i + 1, N, windowStart));

  // Stable transaction ordering and IDs.
  data.transactions.sort(
    (a, b) =>
      new Date(a.postedAt).getTime() - new Date(b.postedAt).getTime() ||
      String(a.accountId ?? a.cardId).localeCompare(String(b.accountId ?? b.cardId)),
  );
  return data;
}

function buildCustomer(
  data: SeedData,
  spec: CustomerSpec,
  idx: number,
  N: Date,
  windowStart: Date,
): void {
  const rng = new Rng(hashSeed(spec.key));
  const customerId = `cus_${spec.key}`;
  const txns: TxnInput[] = [];
  const at = (daysAgo: number): Date =>
    new Date(addDays(N, -daysAgo).getTime() + rng.int(7, 21) * 3_600_000 + rng.int(0, 59) * 60_000);

  data.customers.push({
    id: customerId,
    bankId: BANK_ID,
    externalRef: `DDB-C-${pad(idx, 4)}`,
    displayName: spec.nameEn,
    displayNameAr: spec.nameAr,
    phone: `+97400000${pad(idx, 3)}`,
    email: `${spec.key}@customers.ddb.example.test`,
    preferredLocale: spec.locale,
    segment: spec.segment,
    salaryTransfer: spec.salaryTransfer,
    personaKey: spec.key,
    createdAt: addMonths(N, -(24 + idx)),
  });

  if (spec.consent !== false) {
    for (const purpose of ["pre_decision_insights", "proactive_alerts", "assistant"]) {
      data.consents.push({
        customerId,
        purpose,
        version: "1.0",
        method: "in_app",
        grantedAt: addDays(N, -(30 + idx)),
        privacyPolicyVersion: "2026-01",
      });
    }
  }

  // ── Accounts ────────────────────────────────────────────────────────────────────────────────
  const accountIds: string[] = [];
  let mainAccountId: string | undefined;
  spec.accounts.forEach((a, ai) => {
    const id = `acc_${spec.key}_${a.suffix}`;
    accountIds.push(id);
    const number = `0000${pad(idx, 4)}${pad(ai + 1, 4)}`;
    const lastActivityDaysAgo = a.lastActivityDaysAgo ?? 1;
    data.accounts.push({
      id,
      customerId,
      kind: a.kind,
      variant: a.variant,
      productName: a.productName,
      number,
      iban: `QA00DDBX${number.padStart(21, "0")}`,
      balance: a.balance,
      status: "active",
      isSalaryAccount: a.isSalaryAccount ?? false,
      openedAt: addMonths(N, -12 * (a.openedYearsAgo ?? 3 + (idx % 5))),
      lastActivityAt: addDays(N, -lastActivityDaysAgo),
      dormancyDays: a.dormancyDays ?? 365,
      closureFee: FEE_AMOUNTS.accClosure,
      chequesOutstanding: a.chequesOutstanding ?? 0,
      maintenanceFee: a.maintenanceFee ?? "0.00",
      maintenanceFeeWaived: a.maintenanceFeeWaived ?? false,
    });
    if (mainAccountId === undefined && lastActivityDaysAgo <= 7) mainAccountId = id;

    // Standing orders: next run in the future, monthly history inside the window.
    a.standingOrders?.forEach((so, si) => {
      const nextRunAt = addDays(N, so.nextRunInDays);
      data.standingOrders.push({
        id: `so_${spec.key}_${a.suffix}_${si + 1}`,
        accountId: id,
        payee: so.payee,
        amount: so.amount,
        frequency: so.frequency,
        nextRunAt,
      });
      const step = so.frequency === "monthly" ? 1 : 3;
      for (let k = step; k <= HISTORY_MONTHS; k += step) {
        const runAt = addMonths(nextRunAt, -k);
        if (runAt >= windowStart && runAt < N) {
          txns.push(
            debit({ accountId: id }, so.amount, "standing_order", runAt, so.payee, "transfers"),
          );
        }
      }
    });

    // Account-level fees and activity.
    if (a.maintenanceFee && !a.maintenanceFeeWaived) {
      for (let m = 1; m <= HISTORY_MONTHS; m++) {
        txns.push(
          fee(
            { accountId: id },
            a.maintenanceFee,
            FEE_CODES.accMaintenance,
            addMonths(N, -m),
            "Account maintenance fee",
          ),
        );
      }
    }
    if ((a.chequesOutstanding ?? 0) > 0) {
      txns.push(
        fee(
          { accountId: id },
          FEE_AMOUNTS.accChequeBook,
          FEE_CODES.accChequeBook,
          at(75),
          "Cheque book fee",
        ),
      );
    }
    // Occasional one-off savings activity to anchor lastActivityAt.
    if (a.kind === "savings" && lastActivityDaysAgo <= 180 && lastActivityDaysAgo > 1) {
      txns.push(
        credit(
          { accountId: id },
          rng.amount(500, 3000),
          "transfer_in",
          addDays(N, -lastActivityDaysAgo),
          "Transfer from own account",
          "transfers",
        ),
      );
    }
  });
  const primaryAccount = mainAccountId ?? accountIds[0];
  if (!primaryAccount) throw new Error(`${spec.key} needs an account`);

  // Income, bills, ATM usage and SMS fees on the main account.
  const smsAlerts = hashSeed(spec.key) % 2 === 0;
  for (let m = HISTORY_MONTHS; m >= 1; m--) {
    const cycle = addMonths(N, -m);
    const incomeDay = addDays(cycle, 24);
    if (incomeDay < N) {
      txns.push(
        spec.salaryTransfer
          ? credit(
              { accountId: primaryAccount },
              spec.monthlyIncome,
              "salary",
              incomeDay,
              "Salary (demo employer)",
              "income",
            )
          : credit(
              { accountId: primaryAccount },
              toMoneyString(round(D(spec.monthlyIncome).times(D("0.8")))),
              "transfer_in",
              incomeDay,
              "Incoming transfer",
              "income",
            ),
      );
    }
    for (const bill of BILLS) {
      const d = addDays(cycle, rng.int(2, 20));
      txns.push(
        debit(
          { accountId: primaryAccount },
          rng.amount(150, 650),
          "transfer_out",
          d,
          bill,
          "bills",
        ),
      );
    }
    if (rng.chance(0.35)) {
      const d = addDays(cycle, rng.int(1, 27));
      txns.push(
        debit(
          { accountId: primaryAccount },
          `${rng.int(2, 10) * 100}.00`,
          "cash_withdrawal",
          d,
          "ATM withdrawal (other bank)",
          "cash",
        ),
      );
      txns.push(
        fee(
          { accountId: primaryAccount },
          FEE_AMOUNTS.atmOtherBank,
          FEE_CODES.atmOtherBank,
          d,
          "Other-bank ATM fee",
        ),
      );
    }
    if (smsAlerts && m % 3 === 0) {
      txns.push(
        fee(
          { accountId: primaryAccount },
          FEE_AMOUNTS.accSmsAlerts,
          FEE_CODES.accSmsAlerts,
          addDays(cycle, 1),
          "SMS alerts fee (quarterly)",
        ),
      );
    }
  }

  // ── Cards ───────────────────────────────────────────────────────────────────────────────────
  spec.cards?.forEach((c, ci) =>
    buildCard(
      data,
      txns,
      spec,
      c,
      idx,
      ci + 1,
      customerId,
      primaryAccount,
      N,
      windowStart,
      rng,
      at,
    ),
  );

  // ── Finance ─────────────────────────────────────────────────────────────────────────────────
  spec.finances?.forEach((f) => {
    const id = `fin_${spec.key}_${f.suffix}`;
    const nextDue = addDays(N, f.nextDueInDays);
    const firstDue = addMonths(nextDue, -f.monthsElapsed);
    const schedule = buildSchedule(f, firstDue);
    const paidPrincipal = schedule
      .filter((e) => e.paid)
      .reduce((acc, e) => acc.plus(D(e.principal)), D(0));
    const next = schedule[f.monthsElapsed];
    if (!next) throw new Error(`${id}: monthsElapsed beyond tenor`);
    const islamic = f.type !== "conventional";
    data.finances.push({
      id,
      customerId,
      type: f.type,
      productName: f.productName,
      originalPrincipal: f.originalPrincipal,
      principalOutstanding: toMoneyString(D(f.originalPrincipal).minus(paidPrincipal)),
      ratePct: f.ratePct,
      tenorMonths: f.tenorMonths,
      monthsElapsed: f.monthsElapsed,
      instalment: schedule[0]?.instalment ?? "0.00",
      startAt: addMonths(firstDue, -1),
      nextInstalmentAt: nextDue,
      schedule: schedule as unknown as Prisma.InputJsonValue,
      settlementFeeRule: islamic ? RULES.islamicSettlementFee : RULES.convSettlementFee,
      rebateRule:
        f.type === "murabaha"
          ? RULES.murabahaIbra
          : f.type === "ijara"
            ? RULES.ijaraRebate
            : undefined,
      insuranceOrTakaful: f.cover
        ? {
            kind: f.cover.kind,
            premiumPaid: f.cover.premiumPaid,
            coverMonths: String(f.tenorMonths),
            refundRule: RULES.coverRefund,
          }
        : undefined,
      salaryLinked: f.salaryLinked ?? false,
    });
    for (const e of schedule) {
      const due = new Date(`${e.dueAt}T08:00:00.000Z`);
      if (e.paid && due >= windowStart && due < N) {
        txns.push(
          debit(
            { accountId: primaryAccount },
            e.instalment,
            "instalment",
            due,
            `${f.productName} instalment ${e.n}/${f.tenorMonths}`,
            "finance",
          ),
        );
      }
    }
  });

  // ── Deposits ────────────────────────────────────────────────────────────────────────────────
  spec.deposits?.forEach((d) => {
    const maturityAt = addDays(N, d.maturityInDays);
    const islamic = d.variant === "islamic";
    const startAt = addMonths(maturityAt, -d.termMonths);
    data.deposits.push({
      id: `dep_${spec.key}_${d.suffix}`,
      customerId,
      variant: d.variant,
      productName: d.productName,
      principal: d.principal,
      ratePct: d.ratePct,
      startAt,
      maturityAt,
      breakPenaltyRule: islamic ? RULES.islamicDepositPenalty : RULES.convDepositPenalty,
      profitOnBreakRule: islamic
        ? RULES.islamicDepositProfitOnBreak
        : RULES.convDepositProfitOnBreak,
      payoutAccountId: primaryAccount,
      autoRenew: d.autoRenew ?? false,
    });
    if (startAt >= windowStart) {
      txns.push(
        debit(
          { accountId: primaryAccount },
          d.principal,
          "transfer_out",
          startAt,
          `Placement: ${d.productName}`,
          "deposits",
        ),
      );
    }
  });

  txns.forEach((t, i) => data.transactions.push({ id: `txn_${spec.key}_${pad(i + 1, 4)}`, ...t }));
}

function buildCard(
  data: SeedData,
  txns: TxnInput[],
  spec: CustomerSpec,
  c: CardSpec,
  idx: number,
  cardIdx: number,
  customerId: string,
  settlementAccountId: string,
  N: Date,
  windowStart: Date,
  rng: Rng,
  at: (daysAgo: number) => Date,
): void {
  const id = `card_${spec.key}_${c.suffix}`;
  const pan = syntheticPan(idx, cardIdx);
  const islamic = c.variant === "islamic";
  const statementBalance = D(c.statementBalance);
  const annualFeeChargedAt =
    c.annualFeeChargedMonthsAgo !== undefined ? addMonths(N, -c.annualFeeChargedMonthsAgo) : null;

  data.cards.push({
    id,
    customerId,
    settlementAccountId,
    type: c.variant,
    tier: c.tier,
    productName: c.productName,
    pan,
    panLast4: pan.slice(-4),
    creditLimit: c.limit,
    balance: c.balance,
    statementBalance: c.statementBalance,
    minDue: toMoneyString(minimumDue(statementBalance)),
    paymentDueAt: addDays(N, c.dueInDays),
    profitOrInterestRateApr: c.aprPct,
    cashAdvanceFeePct: toFixedString(D(FEE_AMOUNTS.cashAdvancePct), 4),
    cashAdvanceMinFee: FEE_AMOUNTS.cashAdvanceMin,
    annualFee: c.annualFee,
    annualFeeChargedAt,
    annualFeeWaived: c.annualFeeWaived ?? false,
    feeRefundRule: c.tier === "classic" ? RULES.cardFeeRefundNone : RULES.cardFeeRefundProRata,
    supplementaryCount: c.supplementaryCount ?? 0,
    openedAt: addMonths(N, -12 * (2 + (idx % 6))),
  });

  if (c.rewards) {
    data.rewardsLedgers.push({
      id: `rw_${spec.key}_${c.suffix}`,
      cardId: id,
      balance: c.rewards.buckets.reduce((s, b) => s + b.points, 0),
      pointValueQar: c.rewards.pointValueQar,
      expiryBuckets: c.rewards.buckets.map((b) => ({
        points: b.points,
        expiresAt: isoDate(addDays(N, b.expiresInDays)),
      })),
      pendingCashback: c.rewards.pendingCashback ?? "0.00",
      asOf: N,
    });
  }

  c.instalmentPlans?.forEach((p) => {
    const original = D(p.originalAmount);
    const monthly = round(original.dividedBy(p.months));
    const elapsed = p.months - p.monthsRemaining;
    const startedAt = addMonths(N, -elapsed);
    data.instalmentPlans.push({
      id: `epp_${spec.key}_${p.suffix}`,
      cardId: id,
      description: p.description,
      originalAmount: p.originalAmount,
      principalRemaining: toMoneyString(original.minus(monthly.times(elapsed))),
      monthsRemaining: p.monthsRemaining,
      monthlyAmount: toMoneyString(monthly),
      earlyClosureFeeRule: RULES.eppEarlyClosure,
      startedAt,
    });
    if (startedAt >= windowStart) {
      const processing = max(
        round(percentOf(original, D(FEE_AMOUNTS.eppPct))),
        D(FEE_AMOUNTS.eppMin),
      );
      txns.push(
        fee(
          { cardId: id },
          toMoneyString(processing),
          FEE_CODES.cardEppProcessing,
          startedAt,
          "Instalment plan processing fee",
        ),
      );
    }
    for (let k = 1; k <= elapsed; k++) {
      const d = addMonths(startedAt, k);
      if (d >= windowStart && d < N) {
        txns.push(
          debit(
            { cardId: id },
            toMoneyString(monthly),
            "instalment",
            d,
            `${p.description} ${k}/${p.months}`,
            "instalments",
          ),
        );
      }
    }
  });

  // Monthly purchases, payments, finance charges.
  const profile = SPEND_PROFILE[c.spend];
  for (let m = HISTORY_MONTHS; m >= 1; m--) {
    const cycle = addMonths(N, -m);
    const count = rng.int(profile.perMonth[0], profile.perMonth[1]);
    for (let k = 0; k < count; k++) {
      const category = rng.pick(Object.keys(MERCHANTS));
      const d = addDays(cycle, rng.int(0, 27));
      if (d >= N) continue;
      txns.push(
        debit(
          { cardId: id },
          rng.amount(profile.minQar, profile.maxQar),
          "purchase",
          d,
          rng.pick(MERCHANTS[category] ?? []),
          category,
        ),
      );
    }
    if (c.foreignSpend) {
      for (let k = 0; k < rng.int(2, 4); k++) {
        const amount = rng.amount(100, 1200);
        const d = addDays(cycle, rng.int(0, 27));
        txns.push(
          debit({ cardId: id }, amount, "purchase", d, rng.pick(FOREIGN_MERCHANTS), "shopping"),
        );
        txns.push(
          fee(
            { cardId: id },
            toMoneyString(round(percentOf(D(amount), D(FEE_AMOUNTS.fxPct)))),
            FEE_CODES.cardFx,
            d,
            "Foreign currency transaction fee",
          ),
        );
      }
    }
    const payDay = addDays(cycle, 20);
    const paid =
      c.payment === "full"
        ? rng.amount(800, 4000)
        : c.payment === "minimum"
          ? toMoneyString(minimumDue(statementBalance))
          : toMoneyString(round(statementBalance.times(D("0.30"))));
    txns.push(
      credit({ cardId: id }, paid, "payment", payDay, "Card payment - thank you", "payments"),
    );
    if (c.payment !== "full") {
      const charge = round(statementBalance.times(D(c.aprPct)).dividedBy(1200));
      txns.push({
        cardId: id,
        amount: toMoneyString(charge),
        direction: "debit",
        currency: "QAR",
        type: islamic ? "profit_charge" : "interest_charge",
        merchant: islamic ? "Profit charge" : "Interest charge",
        category: "charges",
        postedAt: addDays(cycle, 1),
        feeCode: islamic ? FEE_CODES.cardProfit : FEE_CODES.cardInterest,
      });
    }
  }

  for (let k = 0; k < (c.latePayments ?? 0); k++) {
    const d = addMonths(N, -(2 + 2 * k));
    txns.push(
      islamic
        ? fee(
            { cardId: id },
            FEE_AMOUNTS.cardLate,
            FEE_CODES.islamicLateCharity,
            d,
            "Late-payment charity amount",
          )
        : fee({ cardId: id }, FEE_AMOUNTS.cardLate, FEE_CODES.cardLate, d, "Late payment fee"),
    );
  }
  if (c.overlimitFee) {
    txns.push(
      fee(
        { cardId: id },
        FEE_AMOUNTS.cardOverlimit,
        FEE_CODES.cardOverlimit,
        addMonths(N, -3),
        "Over-limit fee",
      ),
    );
  }
  if (
    annualFeeChargedAt &&
    !c.annualFeeWaived &&
    D(c.annualFee).greaterThan(0) &&
    annualFeeChargedAt >= windowStart
  ) {
    txns.push(
      fee(
        { cardId: id },
        c.annualFee,
        FEE_CODES.cardAnnual,
        annualFeeChargedAt,
        `Annual fee: ${c.productName}`,
      ),
    );
  }
  if (c.cashAdvance) {
    const d = at(c.cashAdvance.daysAgo);
    const amount = D(c.cashAdvance.amount);
    const cashFee = max(
      round(percentOf(amount, D(FEE_AMOUNTS.cashAdvancePct))),
      D(FEE_AMOUNTS.cashAdvanceMin),
    );
    txns.push(
      debit(
        { cardId: id },
        c.cashAdvance.amount,
        "cash_withdrawal",
        d,
        "ATM cash withdrawal (credit card)",
        "cash",
      ),
    );
    txns.push(
      fee(
        { cardId: id },
        toMoneyString(cashFee),
        FEE_CODES.cardCashAdvance,
        d,
        "Cash withdrawal fee",
      ),
    );
  }
  if (c.largePurchase) {
    const lp = c.largePurchase;
    txns.push(
      debit({ cardId: id }, lp.amount, "purchase", at(lp.daysAgo), lp.merchant, lp.category),
    );
  }
  if (rng.chance(0.15)) {
    txns.push(
      fee(
        { cardId: id },
        FEE_AMOUNTS.cardStatementCopy,
        FEE_CODES.cardStatementCopy,
        at(rng.int(20, 150)),
        "Statement copy fee",
      ),
    );
  }
}

type Owner = { accountId: string } | { cardId: string };

function debit(
  owner: Owner,
  amount: string,
  type: TxnInput["type"],
  postedAt: Date,
  merchant: string,
  category: string,
): TxnInput {
  return {
    ...owner,
    amount,
    direction: "debit",
    currency: "QAR",
    type,
    merchant,
    category,
    postedAt,
    feeCode: null,
  };
}

function credit(
  owner: Owner,
  amount: string,
  type: TxnInput["type"],
  postedAt: Date,
  merchant: string,
  category: string,
): TxnInput {
  return {
    ...owner,
    amount,
    direction: "credit",
    currency: "QAR",
    type,
    merchant,
    category,
    postedAt,
    feeCode: null,
  };
}

function fee(
  owner: Owner,
  amount: string,
  feeCode: string,
  postedAt: Date,
  label: string,
): TxnInput {
  return {
    ...owner,
    amount,
    direction: "debit",
    currency: "QAR",
    type: "fee",
    merchant: label,
    category: "fees",
    postedAt,
    feeCode,
  };
}
