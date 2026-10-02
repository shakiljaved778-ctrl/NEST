import { z } from "zod";
import { RoundingModeSchema } from "../define";
import type { EarlyClosureFeeRule, FeeRefundRule } from "../rules";

export const CardCloseParamsSchema = z.object({
  pointsExpiryWindowDays: z.number().int().min(1).max(365),
  pendingCashbackOnClosure: z.enum(["forfeited", "credited"]),
  /**
   * The rewards programme's QAR value of one point, set by the bank (console). When set it
   * replaces each ledger's own value; null keeps the ledger's value.
   */
  programmePointValueQar: z
    .string()
    .regex(/^\d{1,3}(\.\d{1,4})?$/)
    .nullable(),
  roundingMode: RoundingModeSchema,
});
export type CardCloseParams = z.infer<typeof CardCloseParamsSchema>;

export interface CardCloseInput {
  /** As-of date of the card and instalment data. */
  dataAsOf: Date;
  card: {
    id: string;
    variant: "conventional" | "islamic";
    balance: string;
    annualFee: string;
    annualFeeChargedAt: Date | null;
    annualFeeWaived: boolean;
    feeRefundRule: FeeRefundRule;
    supplementaryCount: number;
  };
  rewards: {
    balance: number;
    pointValueQar: string;
    expiryBuckets: { points: number; expiresAt: string }[];
    pendingCashback: string;
    asOf: Date;
  } | null;
  instalmentPlans: {
    id: string;
    principalRemaining: string;
    monthsRemaining: number;
    monthlyAmount: string;
    earlyClosureFeeRule: EarlyClosureFeeRule;
  }[];
}

export const CARD_CLOSE_FACT_KEYS = [
  "pointsBalance",
  "pointValueQar",
  "pointsValue",
  "pointsExpiringSoon",
  "pointsExpiringSoonValue",
  "nextPointsExpiryDate",
  "pointsExpiryWindowDays",
  "pendingCashback",
  "pendingCashbackForfeited",
  "forfeitedValue",
  "activeInstalmentPlans",
  "instalmentsRemainingPrincipal",
  "instalmentEarlyClosureFees",
  "instalmentsPayableOnClosure",
  "annualFee",
  "annualFeeRefundEligible",
  "annualFeeMonthsUsed",
  "annualFeeRefund",
  "supplementaryCards",
  "outstandingBalance",
  "netAmountToClear",
  "avoidableLoss",
] as const;
export type CardCloseFactKey = (typeof CARD_CLOSE_FACT_KEYS)[number];
