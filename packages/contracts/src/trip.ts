import { z } from "zod";
import { Money } from "./money.js";
import { NormalizedOffer } from "./offers.js";
import { FitScoreBreakdown } from "./scoring.js";
import { ForecastResult } from "./forecast.js";
import { SegmentKind } from "./enums.js";

export const AssembledSegment = z.object({
  kind: SegmentKind,
  offer: NormalizedOffer,
});
export type AssembledSegment = z.infer<typeof AssembledSegment>;

export const TripOption = z.object({
  id: z.string(),
  rank: z.number().int().min(1).max(3), // 1 = primary, 2-3 = alternates
  label: z.string(),
  segments: z.array(AssembledSegment),
  totalPrice: Money,
  fitScore: z.number().min(0).max(1),
  fitBreakdown: FitScoreBreakdown,
  forecast: ForecastResult,
  expiresAt: z.string().datetime(),
});
export type TripOption = z.infer<typeof TripOption>;

/** The agent presents exactly one primary + two alternates. Never a list. */
export const TripPresentation = z.object({
  intentEcho: z.string(),
  clarifyingQuestion: z.string().nullable().default(null),
  primary: TripOption,
  alternates: z.array(TripOption).max(2),
  gaps: z.array(z.string()).default([]), // e.g. "air adapter timed out"
});
export type TripPresentation = z.infer<typeof TripPresentation>;
