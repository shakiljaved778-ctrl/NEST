import { type NormalizedOffer, type HoldToken, money } from "@voyara/contracts";
import type { AirAdapter, AirQuery } from "./types.js";
import { HoldUnavailableError } from "./types.js";
import { FARES, type FareSeed } from "./fixtures/fares.js";

/** Deterministic mock air adapter over the 12-corridor fixture set. */
export class MockAirAdapter implements AirAdapter {
  readonly name = "mock-air";
  private readonly byOffer = new Map<string, FareSeed>();

  async search(q: AirQuery): Promise<NormalizedOffer[]> {
    const currency = q.currency ?? "USD";
    const matches = FARES.filter(
      (f) =>
        eq(f.origin, q.origin) && eq(f.destination, q.destination),
    );
    const offers: NormalizedOffer[] = [];
    for (const f of matches) {
      const totalMinor = f.baseMinor * Math.max(1, q.partySize);
      const offerId = `${f.id}#${q.departDate}#${q.partySize}`;
      this.byOffer.set(offerId, f);
      offers.push({
        id: offerId,
        kind: "FLIGHT",
        supplierRef: `mock-air:${f.id}`,
        title: `${f.airline} ${q.origin}→${q.destination}`,
        city: q.destination,
        neighborhood: null,
        lat: null,
        lng: null,
        price: money(totalMinor, currency),
        perNight: null,
        refundable: f.refundable,
        cancellation: f.refundable
          ? [{ untilIso: q.departDate, penaltyMinor: 0 }]
          : [{ untilIso: q.departDate, penaltyMinor: Math.round(totalMinor * 0.4) }],
        holdable: true,
        holdTtlSeconds: 900,
        rating: null,
        reviewCount: 0,
        style: [],
        amenities: [],
        distanceToAnchorKm: null,
        scheduleQuality: f.scheduleQuality,
        offerPayload: {
          _mock: true,
          airline: f.airline,
          departTime: f.departTime,
          stops: f.stops,
          durationMin: f.durationMin,
        },
      });
    }
    return offers;
  }

  async hold(offerId: string): Promise<HoldToken> {
    const f = this.byOffer.get(offerId);
    if (!f) throw new HoldUnavailableError(offerId);
    return {
      token: `hold_${offerId}_${Date.now()}`,
      offerId,
      supplierRef: `mock-air:${f.id}`,
      expiresAt: new Date(Date.now() + 900_000).toISOString(),
      price: money(f.baseMinor, "USD"),
    };
  }
}

function eq(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}
