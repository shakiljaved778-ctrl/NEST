import { z } from "zod";

/** Autonomy tiers gate what the agent may do without a tap. */
export const AutonomyTier = z.enum(["WATCH", "ASK", "ACT"]);
export type AutonomyTier = z.infer<typeof AutonomyTier>;

export const TripStatus = z.enum([
  "DRAFT",
  "ASSEMBLED",
  "BOOKED",
  "LIVE",
  "COMPLETED",
  "CANCELLED",
]);
export type TripStatus = z.infer<typeof TripStatus>;

export const SegmentKind = z.enum(["FLIGHT", "HOTEL", "GROUND"]);
export type SegmentKind = z.infer<typeof SegmentKind>;

export const Verdict = z.enum(["BUY", "WAIT"]);
export type Verdict = z.infer<typeof Verdict>;

export const PostingDirection = z.enum(["DEBIT", "CREDIT"]);
export type PostingDirection = z.infer<typeof PostingDirection>;

export const FreezeStatus = z.enum(["ACTIVE", "EXERCISED", "EXPIRED"]);
export type FreezeStatus = z.infer<typeof FreezeStatus>;

export const GuardianEventKind = z.enum([
  "DELAY",
  "CANCEL",
  "SCHEDULE_CHANGE",
  "PRICE_DROP",
  "GHOST_INVENTORY",
]);
export type GuardianEventKind = z.infer<typeof GuardianEventKind>;

export const RemediationState = z.enum([
  "PROPOSED",
  "AUTO_EXECUTED",
  "DECLINED",
]);
export type RemediationState = z.infer<typeof RemediationState>;

export const AuditActorType = z.enum([
  "USER",
  "AGENT",
  "PARTNER_AGENT",
  "SYSTEM",
]);
export type AuditActorType = z.infer<typeof AuditActorType>;

export const BookingStatus = z.enum([
  "PENDING",
  "HOLDING",
  "CHARGED",
  "CONFIRMED",
  "FAILED",
  "COMPENSATED",
]);
export type BookingStatus = z.infer<typeof BookingStatus>;
