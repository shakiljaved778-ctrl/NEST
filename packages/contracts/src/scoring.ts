import { z } from "zod";

/**
 * The ONLY input the fit scorer is allowed to receive. It carries traveler
 * fit signals — never supplier margin, commission, or sponsorship. This is
 * the trust moat, enforced mechanically: there is no field here where a
 * supplier could pay for position, and a unit test asserts that a margin
 * key placed on this object never reaches the score.
 */
export const FitScoreInput = z.object({
  tasteMatch: z.number().min(0).max(1), // 0..1 taste-graph alignment
  priceVsBudget: z.number().min(0).max(1), // 1 = well under budget, 0 = over
  location: z.number().min(0).max(1), // proximity to anchor / neighborhood
  reviews: z.number().min(0).max(1), // normalized review quality
  scheduleQuality: z.number().min(0).max(1), // flights; hotels => 1
});
export type FitScoreInput = z.infer<typeof FitScoreInput>;

export const FitScoreBreakdown = z.object({
  score: z.number().min(0).max(1),
  weights: z.record(z.number()),
  contributions: z.record(z.number()),
  signals: z.array(z.string()), // human-readable "why"
});
export type FitScoreBreakdown = z.infer<typeof FitScoreBreakdown>;
