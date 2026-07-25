import { z } from "zod";

export const BudgetBand = z.object({
  category: z.enum(["hotel", "flight", "ground", "total"]),
  minMinor: z.number().int().nonnegative(),
  maxMinor: z.number().int().nonnegative(),
  currency: z.string().length(3),
});
export type BudgetBand = z.infer<typeof BudgetBand>;

export const TastePrefs = z.object({
  airlines: z.array(z.string()).default([]),
  seat: z.enum(["window", "aisle", "any"]).default("any"),
  hotelStyle: z
    .array(z.enum(["boutique", "luxury", "business", "budget", "design", "resort"]))
    .default([]),
  neighborhoods: z.array(z.string()).default([]),
  pace: z.enum(["relaxed", "balanced", "packed"]).default("balanced"),
  dietary: z.array(z.string()).default([]),
  budgetBands: z.array(BudgetBand).default([]),
  amenities: z.array(z.string()).default([]),
});
export type TastePrefs = z.infer<typeof TastePrefs>;

export const TasteGraph = z.object({
  userId: z.string(),
  prefs: TastePrefs,
  /** Optional embedding vector for retrieval; stored as jsonb in Postgres. */
  embedding: z.array(z.number()).nullable().default(null),
  updatedAt: z.string().datetime().optional(),
});
export type TasteGraph = z.infer<typeof TasteGraph>;
