import { z } from "zod";
import { AutonomyTier } from "./enums.js";
import { TripIntent, NormalizedOffer, HoldToken } from "./offers.js";
import { TripPresentation } from "./trip.js";
import { Money } from "./money.js";

/**
 * A capability is a typed tool the agent can call. Tools are defined ONCE here
 * with Zod input/output schemas and reused by three consumers: the internal
 * agent runtime, the NestJS API, and the MCP rails.
 *
 * Tools that move money are tagged MONEY and are hard-gated behind the
 * autonomy-tier check in the runtime — never in the prompt.
 */
export interface ToolDefinition<I extends z.ZodTypeAny, O extends z.ZodTypeAny> {
  name: string;
  description: string;
  /** Does this tool move money? Gated by the runtime, not the prompt. */
  moves: "FREE" | "MONEY";
  /** Minimum autonomy tier that may auto-execute without a tap. */
  minAutoTier: AutonomyTier;
  input: I;
  output: O;
}

export function defineTool<I extends z.ZodTypeAny, O extends z.ZodTypeAny>(
  def: ToolDefinition<I, O>,
): ToolDefinition<I, O> {
  return def;
}

// ── Tool I/O schemas ───────────────────────────────────────────────

export const SearchTripsInput = z.object({
  intentText: z.string().min(1),
  userId: z.string().optional(),
});
export const SearchTripsOutput = TripPresentation;

export const HoldOfferInput = z.object({
  offerId: z.string(),
  userId: z.string().optional(),
});
export const HoldOfferOutput = HoldToken;

export const BookTripInput = z.object({
  tripOptionId: z.string(),
  userId: z.string(),
  holdTokens: z.array(z.string()).default([]),
  paymentMandate: z.string(), // tokenized; raw card data never crosses here
  applyWallet: z.boolean().default(true),
});
export const BookTripOutput = z.object({
  bookingId: z.string(),
  status: z.string(),
  pnrRefs: z.record(z.string()),
  totalCharged: Money,
  walletApplied: Money,
});

export const CancelBookingInput = z.object({
  bookingId: z.string(),
  userId: z.string(),
});
export const CancelBookingOutput = z.object({
  bookingId: z.string(),
  refunded: Money,
  status: z.string(),
});

export const GetTripStatusInput = z.object({ tripId: z.string() });
export const GetTripStatusOutput = z.object({
  tripId: z.string(),
  status: z.string(),
  segments: z.array(z.object({ kind: z.string(), status: z.string() })),
});

export const MonitorTripInput = z.object({ tripId: z.string(), enable: z.boolean() });
export const MonitorTripOutput = z.object({ tripId: z.string(), monitoring: z.boolean() });

// ── The registry: one definition, three consumers ─────────────────

export const TOOLS = {
  search_trips: defineTool({
    name: "search_trips",
    description: "Turn one sentence of intent into one primary trip + two alternates.",
    moves: "FREE",
    minAutoTier: "ASK",
    input: SearchTripsInput,
    output: SearchTripsOutput,
  }),
  hold_offer: defineTool({
    name: "hold_offer",
    description: "Place a (free, refundable) hold on a supplier offer with a TTL.",
    moves: "FREE",
    minAutoTier: "ASK",
    input: HoldOfferInput,
    output: HoldOfferOutput,
  }),
  book_trip: defineTool({
    name: "book_trip",
    description: "Run the checkout saga across all segments and charge payment.",
    moves: "MONEY",
    minAutoTier: "ACT",
    input: BookTripInput,
    output: BookTripOutput,
  }),
  cancel_booking: defineTool({
    name: "cancel_booking",
    description: "Cancel a booking and refund to wallet where supplier rules allow.",
    moves: "MONEY",
    minAutoTier: "ACT",
    input: CancelBookingInput,
    output: CancelBookingOutput,
  }),
  get_trip_status: defineTool({
    name: "get_trip_status",
    description: "Read current status of a trip and its segments.",
    moves: "FREE",
    minAutoTier: "WATCH",
    input: GetTripStatusInput,
    output: GetTripStatusOutput,
  }),
  monitor_trip: defineTool({
    name: "monitor_trip",
    description: "Enable or disable the guardian daemon for a live trip.",
    moves: "FREE",
    minAutoTier: "ASK",
    input: MonitorTripInput,
    output: MonitorTripOutput,
  }),
} as const;

export type ToolName = keyof typeof TOOLS;

export type ToolInput<N extends ToolName> = z.infer<(typeof TOOLS)[N]["input"]>;
export type ToolOutput<N extends ToolName> = z.infer<(typeof TOOLS)[N]["output"]>;
