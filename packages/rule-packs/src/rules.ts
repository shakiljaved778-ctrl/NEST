import { z } from "zod";

/**
 * Product-level rules as stored on product records (Card, InstalmentPlan, Finance). Money and
 * rates are decimal strings (D-004). Zod schemas let the adapters reject malformed rules
 * loudly, instead of silently computing with wrong terms.
 */

const decimal = z.string().regex(/^-?\d+(\.\d+)?$/, "decimal string");

export const FeeRefundRuleSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("none") }),
  z.object({ type: z.literal("pro_rata_months"), withinMonths: decimal }),
]);
export type FeeRefundRule = z.infer<typeof FeeRefundRuleSchema>;

export const EarlyClosureFeeRuleSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("none") }),
  z.object({ type: z.literal("fixed"), amount: decimal }),
  z.object({
    type: z.literal("pct_of_remaining"),
    pct: decimal,
    min: decimal.optional(),
    max: decimal.optional(),
  }),
]);
export type EarlyClosureFeeRule = z.infer<typeof EarlyClosureFeeRuleSchema>;

export const SettlementFeeRuleSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("none") }),
  z.object({ type: z.literal("fixed"), amount: decimal }),
  z.object({
    type: z.literal("pct_of_outstanding"),
    pct: decimal,
    cap: decimal.optional(),
    floor: decimal.optional(),
  }),
]);
export type SettlementFeeRule = z.infer<typeof SettlementFeeRuleSchema>;

export const RebateRuleSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("ibra_tiers"),
    basis: z.literal("deferred_profit_not_yet_due"),
    tiers: z.array(z.object({ minMonthsElapsed: z.number().int().min(0), pct: decimal })).min(1),
  }),
  z.object({ type: z.literal("future_rental_profit_waived"), pct: decimal }),
]);
export type RebateRule = z.infer<typeof RebateRuleSchema>;

export const CoverSchema = z.object({
  kind: z.enum(["insurance", "takaful"]),
  premiumPaid: decimal,
  coverMonths: decimal,
  refundRule: z.discriminatedUnion("type", [
    z.object({ type: z.literal("none") }),
    z.object({ type: z.literal("pro_rata_months_unexpired") }),
  ]),
});
export type Cover = z.infer<typeof CoverSchema>;

export const ScheduleEntrySchema = z.object({
  n: z.number().int().min(1),
  dueAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  principal: decimal,
  profitOrInterest: decimal,
  instalment: decimal,
  balanceAfter: decimal,
  paid: z.boolean(),
});
export type ScheduleEntry = z.infer<typeof ScheduleEntrySchema>;
