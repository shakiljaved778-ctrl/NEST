import { z } from "zod";
import { Money } from "./money.js";
import { Verdict } from "./enums.js";

export const ForecastPoint = z.object({
  date: z.string(), // ISO date
  expectedPriceMinor: z.number().int(),
});
export type ForecastPoint = z.infer<typeof ForecastPoint>;

export const ForecastResult = z.object({
  verdict: Verdict,
  confidence: z.number().min(0).max(1),
  curve: z.array(ForecastPoint), // 14-day forward curve
  rationale: z.string(),
});
export type ForecastResult = z.infer<typeof ForecastResult>;

export const FreezeQuote = z.object({
  offerHash: z.string(),
  lockedPrice: Money,
  fee: Money,
  exposureCap: Money,
  expiresAt: z.string().datetime(),
});
export type FreezeQuote = z.infer<typeof FreezeQuote>;
