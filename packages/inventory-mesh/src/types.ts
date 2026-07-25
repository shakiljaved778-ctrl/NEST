import type { NormalizedOffer, HoldToken } from "@voyara/contracts";

export interface LodgingQuery {
  city: string;
  checkIn: string; // ISO date
  checkOut: string; // ISO date
  nights: number;
  partySize: number;
  neighborhoods?: string[];
  style?: string[];
  maxPerNightMinor?: number | null;
  currency?: string;
}

export interface AirQuery {
  origin: string;
  destination: string;
  departDate: string;
  returnDate?: string | null;
  partySize: number;
  currency?: string;
}

export interface LodgingAdapter {
  readonly name: string;
  search(q: LodgingQuery): Promise<NormalizedOffer[]>;
  hold(offerId: string): Promise<HoldToken>;
}

export interface AirAdapter {
  readonly name: string;
  search(q: AirQuery): Promise<NormalizedOffer[]>;
  hold(offerId: string): Promise<HoldToken>;
}

/** Thrown when an adapter cannot resolve a hold (expired / ghost inventory). */
export class HoldUnavailableError extends Error {
  constructor(public readonly offerId: string) {
    super(`Hold unavailable for offer ${offerId}`);
    this.name = "HoldUnavailableError";
  }
}
