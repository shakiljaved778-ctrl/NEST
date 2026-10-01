/**
 * From a customer's product rows to the input of any rule pack. The API (rows loaded with
 * Prisma) and the persona tests (rows from the seed) share this, so what is tested is exactly what
 * is served. A missing or foreign product, or a missing required context value, resolves to
 * `null`, never to a default: a wrong figure must not reach a customer.
 */
import {
  type PackKey,
  RULE_PACK_KEYS,
  variantForFinanceType,
  BreakPenaltyRuleSchema,
  ProfitOnBreakRuleSchema,
} from "@amil/rule-packs";
import type { AnyEvaluation, Variant } from "@amil/rules-engine";
import { z } from "zod";
import {
  type CardRow,
  type DecimalLike,
  type FinanceRow,
  type InstalmentPlanRow,
  type RewardsRow,
  toCardCloseInput,
  toFinanceSettlementInput,
} from "./adapters";

type DateLike = Date | string;
const dec = (v: DecimalLike): string => {
  if (typeof v === "number") {
    if (!Number.isSafeInteger(v)) throw new TypeError(`Money is decimal: got float ${v}`);
    return String(v);
  }
  return typeof v === "string" ? v : v.toString();
};
const date = (v: DateLike): Date => (v instanceof Date ? v : new Date(v));

export interface BundleAccount {
  id: string;
  variant: Variant;
  balance: DecimalLike;
  status?: "active" | "dormant" | "restricted" | "closed";
  isSalaryAccount?: boolean;
  lastActivityAt: DateLike;
  dormancyDays?: number;
  closureFee: DecimalLike;
  chequesOutstanding?: number;
  maintenanceFee?: DecimalLike;
  maintenanceFeeWaived?: boolean;
  standingOrders: { amount: DecimalLike; nextRunAt: DateLike; active?: boolean }[];
}

export interface BundleCard extends CardRow {
  status?: "active" | "blocked" | "closed";
  settlementAccountId?: string | null;
  creditLimit: DecimalLike;
  statementBalance: DecimalLike;
  minDue: DecimalLike;
  profitOrInterestRateApr: DecimalLike;
  cashAdvanceFeePct: DecimalLike;
  cashAdvanceMinFee: DecimalLike;
  rewards: RewardsRow | null;
  instalmentPlans: InstalmentPlanRow[];
}

export interface BundleFinance extends FinanceRow {
  status?: "active" | "settled" | "closed";
}

export interface BundleDeposit {
  id: string;
  variant: Variant;
  principal: DecimalLike;
  ratePct: DecimalLike;
  startAt: DateLike;
  maturityAt: DateLike;
  breakPenaltyRule: unknown;
  profitOnBreakRule: unknown;
  status?: "active" | "matured" | "broken";
}

export interface BundleTransaction {
  id: string;
  cardId?: string | null;
  amount: DecimalLike;
  type: string;
  direction: string;
}

/** Everything a pack may read about one customer. */
export interface CustomerBundle {
  salaryTransfer: boolean;
  accounts: BundleAccount[];
  cards: BundleCard[];
  finances: BundleFinance[];
  deposits: BundleDeposit[];
  /** Only the transactions a check refers to (EPP conversion). */
  transactions: BundleTransaction[];
}

const positive = z
  .string()
  .regex(/^\d{1,9}(\.\d{1,2})?$/)
  .refine((s) => Number(s) > 0);

/** Context a bank sends with a check. Which keys a pack needs is in PACK_CONTEXT. */
export interface PackContext {
  cardId?: string;
  financeId?: string;
  depositId?: string;
  accountId?: string;
  transactionId?: string;
  amount?: string;
  paymentAmount?: string;
  months?: number;
}

/** The product id each pack is about (for deep links and alert dedupe). */
export const PACK_SUBJECT: Record<PackKey, keyof PackContext | null> = {
  "card.close": "cardId",
  "finance.early_settlement": "financeId",
  "finance.top_up": "financeId",
  "card.cash_withdrawal": "cardId",
  "card.minimum_payment": "cardId",
  "card.epp_conversion": "cardId",
  "card.balance_transfer": "cardId",
  "deposit.break": "depositId",
  "salary.transfer_change": null,
  "account.close": "accountId",
  "account.dormancy": "accountId",
  "rewards.expiry": "cardId",
};

/** Context values a check must carry for each pack (beyond the customer). */
export const PACK_REQUIRED_CONTEXT: Record<PackKey, readonly (keyof PackContext)[]> = {
  "card.close": ["cardId"],
  "finance.early_settlement": ["financeId"],
  "finance.top_up": ["financeId", "amount"],
  "card.cash_withdrawal": ["cardId", "amount"],
  "card.minimum_payment": ["cardId"],
  "card.epp_conversion": ["cardId", "transactionId"],
  "card.balance_transfer": ["cardId", "amount"],
  "deposit.break": ["depositId"],
  "salary.transfer_change": [],
  "account.close": ["accountId"],
  "account.dormancy": ["accountId"],
  "rewards.expiry": ["cardId"],
};

export interface ResolvedInput {
  variant: Variant;
  input: unknown;
}

const active = <T extends { id: string; status?: string }>(rows: T[], id: string | undefined) =>
  id === undefined
    ? undefined
    : rows.find((r) => r.id === id && (r.status ?? "active") === "active");

function cardBasics(card: BundleCard) {
  return { id: card.id, variant: card.type };
}

/**
 * Engine input for `key` from a customer's rows. `null` when the subject is missing, not the
 * customer's, not active, or a required context value is absent or malformed.
 */
export function resolvePackInput(
  key: PackKey,
  bundle: CustomerBundle,
  ctx: PackContext,
  dataAsOf: Date,
): ResolvedInput | null {
  const card = active(bundle.cards, ctx.cardId);
  const finance = active(bundle.finances, ctx.financeId);
  const amount =
    ctx.amount !== undefined && positive.safeParse(ctx.amount).success ? ctx.amount : undefined;
  switch (key) {
    case "card.close":
      return card
        ? {
            variant: card.type,
            input: toCardCloseInput(card, card.rewards, card.instalmentPlans, dataAsOf),
          }
        : null;
    case "finance.early_settlement":
      return finance
        ? {
            variant: variantForFinanceType(finance.type),
            input: toFinanceSettlementInput(finance, dataAsOf),
          }
        : null;
    case "finance.top_up":
      if (!finance || !amount) return null;
      return {
        variant: variantForFinanceType(finance.type),
        input: {
          ...toFinanceSettlementInput(finance, dataAsOf),
          topUpAmount: amount,
          newTenorMonths: ctx.months ?? 60,
        },
      };
    case "card.cash_withdrawal":
      if (!card || !amount) return null;
      return {
        variant: card.type,
        input: {
          dataAsOf,
          card: {
            ...cardBasics(card),
            balance: dec(card.balance),
            creditLimit: dec(card.creditLimit),
            aprPct: dec(card.profitOrInterestRateApr),
            cashAdvanceFeePct: dec(card.cashAdvanceFeePct),
            cashAdvanceMinFee: dec(card.cashAdvanceMinFee),
          },
          amount,
        },
      };
    case "card.minimum_payment": {
      if (!card) return null;
      const payment =
        ctx.paymentAmount !== undefined && positive.safeParse(ctx.paymentAmount).success
          ? ctx.paymentAmount
          : undefined;
      if (ctx.paymentAmount !== undefined && !payment) return null;
      return {
        variant: card.type,
        input: {
          dataAsOf,
          card: {
            ...cardBasics(card),
            statementBalance: dec(card.statementBalance),
            minDue: dec(card.minDue),
            aprPct: dec(card.profitOrInterestRateApr),
          },
          ...(payment ? { comparisonPayment: payment } : {}),
        },
      };
    }
    case "card.epp_conversion": {
      const txn = bundle.transactions.find(
        (t) =>
          t.id === ctx.transactionId &&
          t.cardId === card?.id &&
          t.type === "purchase" &&
          t.direction === "debit",
      );
      if (!card || !txn) return null;
      return {
        variant: card.type,
        input: {
          dataAsOf,
          card: { ...cardBasics(card), aprPct: dec(card.profitOrInterestRateApr) },
          purchase: { amount: dec(txn.amount), transactionId: txn.id },
          months: ctx.months ?? 6,
        },
      };
    }
    case "card.balance_transfer":
      if (!card || !amount) return null;
      return {
        variant: card.type,
        input: {
          dataAsOf,
          card: { ...cardBasics(card), aprPct: dec(card.profitOrInterestRateApr) },
          amount,
        },
      };
    case "deposit.break": {
      const d = active(bundle.deposits, ctx.depositId);
      if (!d) return null;
      return {
        variant: d.variant,
        input: {
          dataAsOf,
          deposit: {
            id: d.id,
            variant: d.variant,
            principal: dec(d.principal),
            ratePct: dec(d.ratePct),
            startAt: date(d.startAt),
            maturityAt: date(d.maturityAt),
            breakPenaltyRule: BreakPenaltyRuleSchema.parse(d.breakPenaltyRule),
            profitOnBreakRule: ProfitOnBreakRuleSchema.parse(d.profitOnBreakRule),
          },
        },
      };
    }
    case "salary.transfer_change": {
      const salaryAccount = bundle.accounts.find(
        (a) => a.isSalaryAccount && (a.status ?? "active") === "active",
      );
      const variant = salaryAccount?.variant ?? bundle.accounts[0]?.variant ?? "conventional";
      const finances = bundle.finances.filter((f) => (f.status ?? "active") === "active");
      return {
        variant,
        input: {
          dataAsOf,
          variant,
          salaryTransfer: bundle.salaryTransfer,
          accounts: bundle.accounts
            .filter((a) => (a.status ?? "active") === "active")
            .map((a) => ({
              id: a.id,
              maintenanceFee: dec(a.maintenanceFee ?? "0"),
              maintenanceFeeWaived: a.maintenanceFeeWaived ?? false,
            })),
          cards: bundle.cards
            .filter((c) => (c.status ?? "active") === "active")
            .map((c) => ({
              id: c.id,
              annualFee: dec(c.annualFee),
              annualFeeWaived: c.annualFeeWaived ?? false,
            })),
          finances: finances.map((f) => {
            const base = toFinanceSettlementInput(f, dataAsOf).finance;
            return {
              id: f.id,
              type: f.type,
              ratePct: base.ratePct,
              salaryLinked: base.salaryLinked,
              schedule: base.schedule,
            };
          }),
        },
      };
    }
    case "account.close": {
      const a = active(bundle.accounts, ctx.accountId);
      if (!a) return null;
      const salary = a.isSalaryAccount ?? false;
      return {
        variant: a.variant,
        input: {
          dataAsOf,
          account: {
            id: a.id,
            variant: a.variant,
            balance: dec(a.balance),
            closureFee: dec(a.closureFee),
            chequesOutstanding: a.chequesOutstanding ?? 0,
            isSalaryAccount: salary,
            standingOrders: a.standingOrders.map((o) => ({
              amount: dec(o.amount),
              nextRunAt: date(o.nextRunAt),
              active: o.active ?? true,
            })),
          },
          linkedCards: bundle.cards.filter(
            (c) => c.settlementAccountId === a.id && (c.status ?? "active") === "active",
          ).length,
          salaryLinkedFinances: salary
            ? bundle.finances.filter((f) => f.salaryLinked && (f.status ?? "active") === "active")
                .length
            : 0,
        },
      };
    }
    case "account.dormancy": {
      const a = bundle.accounts.find((x) => x.id === ctx.accountId);
      if (!a) return null;
      return {
        variant: a.variant,
        input: {
          dataAsOf,
          account: {
            id: a.id,
            variant: a.variant,
            balance: dec(a.balance),
            status: a.status ?? "active",
            lastActivityAt: date(a.lastActivityAt),
            dormancyDays: a.dormancyDays ?? 365,
          },
        },
      };
    }
    case "rewards.expiry": {
      const c = bundle.cards.find((x) => x.id === ctx.cardId);
      if (!c?.rewards) return null;
      const closeInput = toCardCloseInput(c, c.rewards, [], dataAsOf);
      const rewards = closeInput.rewards as NonNullable<typeof closeInput.rewards>;
      return {
        variant: c.type,
        input: {
          dataAsOf,
          card: { ...cardBasics(c), status: c.status ?? "active" },
          rewards: {
            balance: rewards.balance,
            pointValueQar: rewards.pointValueQar,
            expiryBuckets: rewards.expiryBuckets,
            asOf: rewards.asOf,
          },
        },
      };
    }
  }
}

/** Proactive packs: the products to evaluate for one customer on a scheduled run. */
export function proactiveContexts(key: PackKey, bundle: CustomerBundle): PackContext[] {
  if (key === "account.dormancy")
    return bundle.accounts
      .filter((a) => (a.status ?? "active") === "active")
      .map((a) => ({ accountId: a.id }));
  if (key === "rewards.expiry")
    return bundle.cards
      .filter((c) => (c.status ?? "active") === "active" && c.rewards)
      .map((c) => ({ cardId: c.id }));
  return [];
}

/**
 * One alert per product and expiry event: re-running the scheduler the same day (or the next)
 * does not alert the customer again about the same date.
 */
export function alertDedupeKey(key: PackKey, ctx: PackContext, evaluation: AnyEvaluation): string {
  const subjectKey = PACK_SUBJECT[key];
  const subject = subjectKey ? String(ctx[subjectKey] ?? "") : "customer";
  const dateFact =
    key === "account.dormancy"
      ? "dormancyDate"
      : key === "rewards.expiry"
        ? "nextExpiryDate"
        : null;
  const fact = dateFact ? evaluation.facts[dateFact] : undefined;
  const when = fact && !Array.isArray(fact) ? fact.value : "";
  return `${key}:${subject}:${when}`;
}

export const ALL_PACK_KEYS: readonly PackKey[] = RULE_PACK_KEYS;

/**
 * Demo contexts: the products and amounts the demo bank offers for each action, used by the
 * persona coverage tests and the demo app's buttons. Amounts are synthetic examples.
 */
export const DEMO_AMOUNTS = {
  cashWithdrawal: "1000.00",
  balanceTransfer: "5000.00",
  topUp: "20000.00",
  topUpMonths: 60,
  eppMinPurchase: "1000.00",
  eppMonths: 6,
} as const;

export function demoContexts(key: PackKey, bundle: CustomerBundle): PackContext[] {
  const activeCards = bundle.cards.filter((c) => (c.status ?? "active") === "active");
  const activeFinances = bundle.finances.filter((f) => (f.status ?? "active") === "active");
  switch (key) {
    case "card.close":
    case "card.minimum_payment":
      return activeCards.map((c) => ({ cardId: c.id }));
    case "card.cash_withdrawal":
      return activeCards.map((c) => ({ cardId: c.id, amount: DEMO_AMOUNTS.cashWithdrawal }));
    case "card.balance_transfer":
      return activeCards.map((c) => ({ cardId: c.id, amount: DEMO_AMOUNTS.balanceTransfer }));
    case "card.epp_conversion":
      return activeCards.flatMap((c) => {
        const largest = largestPurchase(bundle, c.id);
        return largest
          ? [{ cardId: c.id, transactionId: largest.id, months: DEMO_AMOUNTS.eppMonths }]
          : [];
      });
    case "finance.early_settlement":
      return activeFinances.map((f) => ({ financeId: f.id }));
    case "finance.top_up":
      return activeFinances.map((f) => ({
        financeId: f.id,
        amount: DEMO_AMOUNTS.topUp,
        months: DEMO_AMOUNTS.topUpMonths,
      }));
    case "deposit.break":
      return bundle.deposits
        .filter((d) => (d.status ?? "active") === "active")
        .map((d) => ({ depositId: d.id }));
    case "salary.transfer_change":
      return [{}];
    case "account.close":
      return bundle.accounts
        .filter((a) => (a.status ?? "active") === "active")
        .map((a) => ({ accountId: a.id }));
    case "account.dormancy":
    case "rewards.expiry":
      return proactiveContexts(key, bundle);
  }
}

/** The largest card purchase at or above the demo EPP minimum, if any. */
export function largestPurchase(
  bundle: CustomerBundle,
  cardId: string,
): BundleTransaction | undefined {
  const min = Number(DEMO_AMOUNTS.eppMinPurchase);
  return bundle.transactions
    .filter(
      (t) =>
        t.cardId === cardId &&
        t.type === "purchase" &&
        t.direction === "debit" &&
        Number(dec(t.amount)) >= min,
    )
    .sort((a, b) => Number(dec(b.amount)) - Number(dec(a.amount)))[0];
}
