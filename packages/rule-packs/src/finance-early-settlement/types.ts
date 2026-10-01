import { z } from "zod";
import { RoundingModeSchema } from "../define";
import type { Cover, RebateRule, ScheduleEntry, SettlementFeeRule } from "../rules";

export const FinanceSettlementParamsSchema = z.object({
  /** Look-ahead for the cheapest settlement date (days from today, inclusive). */
  horizonDays: z.number().int().min(0).max(366),
  /** Day-count basis for accrued interest / profit (actual/basis). */
  dayCountBasis: z.union([z.literal(360), z.literal(365)]),
  roundingMode: RoundingModeSchema,
  partialPrepaymentAllowed: z.boolean(),
});
export type FinanceSettlementParams = z.infer<typeof FinanceSettlementParamsSchema>;

export type FinanceType = "conventional" | "murabaha" | "ijara";

export interface FinanceSettlementInput {
  dataAsOf: Date;
  finance: {
    id: string;
    type: FinanceType;
    /** Annual percent */
    ratePct: string;
    tenorMonths: number;
    startAt: Date;
    schedule: ScheduleEntry[];
    settlementFeeRule: SettlementFeeRule;
    rebateRule: RebateRule | null;
    cover: Cover | null;
    salaryLinked: boolean;
  };
}

export const FINANCE_SETTLEMENT_FACT_KEYS = [
  "financeType",
  "settlementAmountToday",
  "outstandingPrincipal",
  "accruedInterest",
  "accruedProfit",
  "settlementFee",
  "settlementFeePct",
  "deferredPriceOutstanding",
  "deferredProfitNotYetDue",
  "ibraRebatePct",
  "ibraRebate",
  "futureProfitNotCharged",
  "arrearsAmount",
  "coverKind",
  "coverRefundToday",
  "netOutflowToday",
  "nextInstalmentDate",
  "nextInstalmentAmount",
  "settlementHorizonDays",
  "cheapestSettlementDate",
  "daysToCheapestDate",
  "instalmentsBeforeCheapestDate",
  "instalmentsAmountBeforeCheapestDate",
  "netOutflowOnCheapestDate",
  "savingIfSettledOnCheapestDate",
  "salaryLinked",
] as const;
export type FinanceSettlementFactKey = (typeof FINANCE_SETTLEMENT_FACT_KEYS)[number];
