/**
 * Adapters from stored product rows (Prisma models, or the seed's create inputs) to rules-engine
 * inputs. Product rules stored as JSON are validated with Zod here. A malformed rule throws,
 * and is never silently replaced by a default, so a wrong figure can't reach a customer.
 */
import {
  type CardCloseInput,
  CoverSchema,
  EarlyClosureFeeRuleSchema,
  FeeRefundRuleSchema,
  type FinanceSettlementInput,
  RebateRuleSchema,
  ScheduleEntrySchema,
  SettlementFeeRuleSchema,
} from "@amil/rule-packs";
import type { SeverityThresholds } from "@amil/rules-engine";
import { z } from "zod";

/** Prisma.Decimal, a decimal string, or a safe integer. */
export type DecimalLike = string | number | { toString(): string };
type DateLike = Date | string;

function dec(v: DecimalLike): string {
  if (typeof v === "number") {
    if (!Number.isSafeInteger(v)) throw new TypeError(`Money is decimal: got float ${v}`);
    return String(v);
  }
  return typeof v === "string" ? v : v.toString();
}
const date = (v: DateLike): Date => (v instanceof Date ? v : new Date(v));

export interface CardRow {
  id: string;
  type: "conventional" | "islamic";
  balance: DecimalLike;
  annualFee: DecimalLike;
  annualFeeChargedAt?: DateLike | null;
  annualFeeWaived?: boolean;
  feeRefundRule: unknown;
  supplementaryCount?: number;
}
export interface RewardsRow {
  balance: number;
  pointValueQar: DecimalLike;
  expiryBuckets: unknown;
  pendingCashback?: DecimalLike;
  asOf: DateLike;
}
export interface InstalmentPlanRow {
  id: string;
  principalRemaining: DecimalLike;
  monthsRemaining: number;
  monthlyAmount: DecimalLike;
  earlyClosureFeeRule: unknown;
  status?: string;
}

const BucketsSchema = z.array(
  z.object({ points: z.number().int().min(0), expiresAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) }),
);

export function toCardCloseInput(
  card: CardRow,
  rewards: RewardsRow | null | undefined,
  plans: InstalmentPlanRow[],
  dataAsOf: Date,
): CardCloseInput {
  return {
    dataAsOf,
    card: {
      id: card.id,
      variant: card.type,
      balance: dec(card.balance),
      annualFee: dec(card.annualFee),
      annualFeeChargedAt: card.annualFeeChargedAt ? date(card.annualFeeChargedAt) : null,
      annualFeeWaived: card.annualFeeWaived ?? false,
      feeRefundRule: FeeRefundRuleSchema.parse(card.feeRefundRule),
      supplementaryCount: card.supplementaryCount ?? 0,
    },
    rewards: rewards
      ? {
          balance: rewards.balance,
          pointValueQar: dec(rewards.pointValueQar),
          expiryBuckets: BucketsSchema.parse(rewards.expiryBuckets),
          pendingCashback: dec(rewards.pendingCashback ?? "0"),
          asOf: date(rewards.asOf),
        }
      : null,
    instalmentPlans: plans
      .filter((p) => (p.status ?? "active") === "active")
      .map((p) => ({
        id: p.id,
        principalRemaining: dec(p.principalRemaining),
        monthsRemaining: p.monthsRemaining,
        monthlyAmount: dec(p.monthlyAmount),
        earlyClosureFeeRule: EarlyClosureFeeRuleSchema.parse(p.earlyClosureFeeRule),
      })),
  };
}

export interface FinanceRow {
  id: string;
  type: "conventional" | "murabaha" | "ijara";
  ratePct: DecimalLike;
  tenorMonths: number;
  startAt: DateLike;
  schedule: unknown;
  settlementFeeRule: unknown;
  rebateRule?: unknown;
  insuranceOrTakaful?: unknown;
  salaryLinked?: boolean;
}

export function toFinanceSettlementInput(
  finance: FinanceRow,
  dataAsOf: Date,
): FinanceSettlementInput {
  return {
    dataAsOf,
    finance: {
      id: finance.id,
      type: finance.type,
      ratePct: dec(finance.ratePct),
      tenorMonths: finance.tenorMonths,
      startAt: date(finance.startAt),
      schedule: z.array(ScheduleEntrySchema).min(1).parse(finance.schedule),
      settlementFeeRule: SettlementFeeRuleSchema.parse(finance.settlementFeeRule),
      rebateRule:
        finance.rebateRule === undefined || finance.rebateRule === null
          ? null
          : RebateRuleSchema.parse(finance.rebateRule),
      cover:
        finance.insuranceOrTakaful === undefined || finance.insuranceOrTakaful === null
          ? null
          : CoverSchema.parse(finance.insuranceOrTakaful),
      salaryLinked: finance.salaryLinked ?? false,
    },
  };
}

const ThresholdsSchema = z.object({ cautionAtQar: z.string(), criticalAtQar: z.string() });

/** The bank's thresholds for a pack, falling back to the bank's `default` entry. */
export function thresholdsFor(severityThresholds: unknown, packKey: string): SeverityThresholds {
  const all = z.record(z.string(), ThresholdsSchema).parse(severityThresholds);
  const t = all[packKey] ?? all.default;
  if (!t) throw new Error(`No severity thresholds for ${packKey} and no default`);
  return t;
}
