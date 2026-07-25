import { z } from "zod";
import { Money } from "./money.js";
import { SegmentKind } from "./enums.js";

/** One sentence of traveler intent, parsed into structure. */
export const TripIntent = z.object({
  raw: z.string().min(1),
  origin: z.string().nullable().default(null),
  destinations: z.array(z.string()).min(1),
  checkIn: z.string().nullable().default(null), // ISO date
  checkOut: z.string().nullable().default(null),
  nights: z.number().int().positive().nullable().default(null),
  partySize: z.number().int().positive().default(1),
  budgetPerNightMinor: z.number().int().positive().nullable().default(null),
  budgetCapMinor: z.number().int().positive().nullable().default(null),
  currency: z.string().length(3).default("USD"),
  hotelStyle: z.array(z.string()).default([]),
  neighborhoods: z.array(z.string()).default([]),
  needsFlight: z.boolean().default(false),
  /** Fields the parser could not resolve and may ask about (max one question). */
  unresolved: z.array(z.string()).default([]),
});
export type TripIntent = z.infer<typeof TripIntent>;

export const CancellationWindow = z.object({
  untilIso: z.string(),
  penaltyMinor: z.number().int().nonnegative(),
});
export type CancellationWindow = z.infer<typeof CancellationWindow>;

/**
 * Every supplier offer is normalized to this shape. Note: there is NO
 * margin / commission / sponsorship field anywhere in this schema. Ranking
 * cannot see supplier economics because the data structurally does not carry it.
 */
export const NormalizedOffer = z.object({
  id: z.string(),
  kind: SegmentKind,
  supplierRef: z.string(),
  title: z.string(),
  city: z.string(),
  neighborhood: z.string().nullable().default(null),
  lat: z.number().nullable().default(null),
  lng: z.number().nullable().default(null),
  price: Money,
  perNight: Money.nullable().default(null),
  refundable: z.boolean(),
  cancellation: z.array(CancellationWindow).default([]),
  holdable: z.boolean().default(true),
  holdTtlSeconds: z.number().int().positive().default(600),
  rating: z.number().min(0).max(5).nullable().default(null),
  reviewCount: z.number().int().nonnegative().default(0),
  style: z.array(z.string()).default([]),
  amenities: z.array(z.string()).default([]),
  distanceToAnchorKm: z.number().nullable().default(null),
  scheduleQuality: z.number().min(0).max(1).nullable().default(null), // flights
  /** Raw supplier payload preserved verbatim. */
  offerPayload: z.record(z.unknown()).default({}),
});
export type NormalizedOffer = z.infer<typeof NormalizedOffer>;

export const HoldToken = z.object({
  token: z.string(),
  offerId: z.string(),
  supplierRef: z.string(),
  expiresAt: z.string().datetime(),
  price: Money,
});
export type HoldToken = z.infer<typeof HoldToken>;
