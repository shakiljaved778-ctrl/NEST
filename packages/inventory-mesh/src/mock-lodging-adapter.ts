import {
  type NormalizedOffer,
  type HoldToken,
  money,
} from "@voyara/contracts";
import type { LodgingAdapter, LodgingQuery } from "./types.js";
import { HoldUnavailableError } from "./types.js";
import { HOTELS, type HotelSeed } from "./fixtures/hotels.js";

/** Deterministic mock lodging adapter over rich fixtures. Zero external keys. */
export class MockLodgingAdapter implements LodgingAdapter {
  readonly name = "mock-lodging";
  private readonly byOffer = new Map<string, { seed: HotelSeed; nights: number; party: number }>();

  async search(q: LodgingQuery): Promise<NormalizedOffer[]> {
    const nights = Math.max(1, q.nights);
    const seeds = HOTELS.filter(
      (h) => h.city.toLowerCase() === q.city.toLowerCase(),
    );

    const offers: NormalizedOffer[] = [];
    for (const seed of seeds) {
      // party > 2 nudges nightly up (larger room), stays integer minor units.
      const partyFactor = q.partySize > 2 ? 1 + (q.partySize - 2) * 0.2 : 1;
      const perNightMinor = Math.round(seed.nightlyMinor * partyFactor);
      if (q.maxPerNightMinor && perNightMinor > q.maxPerNightMinor) continue;

      const totalMinor = perNightMinor * nights;
      const currency = q.currency ?? "USD";
      const offerId = `${seed.id}#${q.checkIn}#${nights}#${q.partySize}`;
      this.byOffer.set(offerId, { seed, nights, party: q.partySize });

      offers.push({
        id: offerId,
        kind: "HOTEL",
        supplierRef: `mock-lodging:${seed.id}`,
        title: seed.name,
        city: seed.city,
        neighborhood: seed.neighborhood,
        lat: null,
        lng: null,
        price: money(totalMinor, currency),
        perNight: money(perNightMinor, currency),
        refundable: seed.refundable,
        cancellation: seed.refundable
          ? [{ untilIso: q.checkIn, penaltyMinor: 0 }]
          : [{ untilIso: q.checkIn, penaltyMinor: perNightMinor }],
        holdable: true,
        holdTtlSeconds: 600,
        rating: seed.rating,
        reviewCount: seed.reviewCount,
        style: seed.style,
        amenities: seed.amenities,
        distanceToAnchorKm: seed.distanceToAnchorKm,
        scheduleQuality: null,
        offerPayload: {
          _mock: true,
          seedId: seed.id,
          anchor: seed.anchor,
          neighborhood: seed.neighborhood,
        },
      });
    }
    return offers;
  }

  async hold(offerId: string): Promise<HoldToken> {
    const rec = this.byOffer.get(offerId);
    if (!rec) throw new HoldUnavailableError(offerId);
    const currency = "USD";
    const total = rec.seed.nightlyMinor * rec.nights;
    return {
      token: `hold_${offerId}_${Date.now()}`,
      offerId,
      supplierRef: `mock-lodging:${rec.seed.id}`,
      expiresAt: new Date(Date.now() + 600_000).toISOString(),
      price: money(total, currency),
    };
  }
}
