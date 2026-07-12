import { PROVIDERS } from "./providers";
import { getBooking } from "./store";
import type { ZoneId } from "./types";

/**
 * Live tracking (MVP) — deterministic journey simulation behind the same
 * contract the production WebSocket stream pushes (position, ETA, phase,
 * safety panel). Clients poll GET /api/bookings/:id/tracking; production
 * swaps polling for a WS subscription without changing the payload.
 */

export type TrackingPhase = "assigning" | "preparing" | "en_route" | "on_site" | "finished" | "cancelled";

export interface LatLng {
  lat: number;
  lng: number;
}

export interface TrackingSnapshot {
  bookingId: string;
  phase: TrackingPhase;
  /** Provider position (null before assignment). */
  position: LatLng | null;
  destination: LatLng;
  etaMinutes: number | null;
  progress: number; // 0–1 of the drive
  safetyPanel: {
    providerName: string | null;
    verified: boolean;
    checks: string[];
    sosNumber: string;
  };
}

/** Approximate zone centroids for the Doha launch map. */
export const ZONE_COORDS: Record<ZoneId, LatLng> = {
  "west-bay": { lat: 25.3208, lng: 51.5309 },
  "the-pearl": { lat: 25.3697, lng: 51.5473 },
  lusail: { lat: 25.438, lng: 51.4903 },
  "al-sadd": { lat: 25.2782, lng: 51.5163 },
  "al-rayyan": { lat: 25.2919, lng: 51.4244 },
  "al-wakrah": { lat: 25.1715, lng: 51.6034 },
  msheireb: { lat: 25.2867, lng: 51.5333 },
  "al-khor": { lat: 25.6804, lng: 51.4969 },
};

const DRIVE_MINUTES = 18; // typical intra-zone drive in the pilot area

/** Deterministic per-booking start offset so every trip looks distinct. */
function startPointFor(bookingId: string, dest: LatLng): LatLng {
  let h = 0;
  for (const ch of bookingId) h = (h * 31 + ch.charCodeAt(0)) % 997;
  const angle = (h / 997) * 2 * Math.PI;
  const radius = 0.025 + (h % 13) / 1000; // ~2.5–3.8 km
  return { lat: dest.lat + Math.sin(angle) * radius, lng: dest.lng + Math.cos(angle) * radius };
}

export function trackBooking(bookingId: string, now = Date.now()): TrackingSnapshot {
  const booking = getBooking(bookingId);
  if (!booking) throw new Error(`Unknown booking: ${bookingId}`);

  const destination = ZONE_COORDS[booking.zoneId];
  const provider = booking.providerId ? PROVIDERS.find((p) => p.id === booking.providerId) : undefined;

  const safetyPanel = {
    providerName: provider?.name ?? null,
    verified: provider?.verified ?? false,
    checks: provider ? ["QID verified", "Background checked", `${provider.jobsDone} jobs completed`] : [],
    sosNumber: "999",
  };

  const base = { bookingId, destination, safetyPanel };

  switch (booking.status) {
    case "pending_match":
    case "matched":
      return { ...base, phase: "assigning", position: null, etaMinutes: null, progress: 0 };
    case "accepted":
      return {
        ...base,
        phase: "preparing",
        position: startPointFor(bookingId, destination),
        etaMinutes: DRIVE_MINUTES + 10,
        progress: 0,
      };
    case "en_route": {
      const start = startPointFor(bookingId, destination);
      const elapsedMin = Math.max(0, (now - new Date(booking.createdAt).getTime()) / 60000);
      const progress = Math.min(1, elapsedMin / DRIVE_MINUTES);
      return {
        ...base,
        phase: "en_route",
        position: {
          lat: start.lat + (destination.lat - start.lat) * progress,
          lng: start.lng + (destination.lng - start.lng) * progress,
        },
        etaMinutes: Math.max(1, Math.ceil((1 - progress) * DRIVE_MINUTES)),
        progress: Math.round(progress * 100) / 100,
      };
    }
    case "arrived":
    case "in_progress":
      return { ...base, phase: "on_site", position: destination, etaMinutes: 0, progress: 1 };
    case "completed":
      return { ...base, phase: "finished", position: destination, etaMinutes: 0, progress: 1 };
    case "cancelled":
      return { ...base, phase: "cancelled", position: null, etaMinutes: null, progress: 0 };
  }
}
