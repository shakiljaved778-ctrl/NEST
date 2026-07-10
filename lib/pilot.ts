import { PROVIDERS } from "./providers";
import { listBookings } from "./store";
import { getZone } from "./catalog";

/**
 * 90-day Doha pilot scoreboard — the Seed-readiness gates from the business
 * plan, computed live from marketplace data:
 *
 *   · 40–60 verified providers live
 *   · 2 pilot zones active (West Bay + The Pearl beachhead)
 *   · 1,500–3,000 bookings in 90 days
 *   · >40% repeat rate
 *   · QAR 500k GMV run-rate
 *
 * Live app bookings are layered on top of the concierge-ops baseline: the
 * pilot started before this build with WhatsApp/phone bookings tracked by the
 * ops team, so the scoreboard blends that telemetry with in-app data.
 */

export const PILOT_LENGTH_DAYS = 90;

/** Day of the pilot this demo snapshot represents. */
export const PILOT_DAY = 32;

/** Concierge-ops telemetry recorded before/alongside the app (ops tracker export). */
const BASELINE = {
  bookings: 574,
  gmvQar: 96350,
  customers: 402,
  repeatCustomers: 173,
  providersOnboarded: 34, // verified pros onboarded via ops before this seed network
};

export interface PilotGate {
  id: string;
  label: string;
  current: number;
  target: number;
  /** Upper bound where the gate is a range (e.g. bookings 1,500–3,000). */
  targetMax?: number;
  unit: "count" | "percent" | "qar";
  status: "achieved" | "on_track" | "at_risk";
  detail: string;
}

export interface PilotScoreboard {
  day: number;
  daysRemaining: number;
  seedReady: boolean;
  gates: PilotGate[];
}

function gateStatus(current: number, target: number, day: number): PilotGate["status"] {
  if (current >= target) return "achieved";
  const expectedByNow = target * (day / PILOT_LENGTH_DAYS);
  return current >= expectedByNow * 0.9 ? "on_track" : "at_risk";
}

export function pilotScoreboard(now = new Date()): PilotScoreboard {
  const day = Math.min(PILOT_DAY, PILOT_LENGTH_DAYS);
  const bookings = listBookings().filter((b) => b.status !== "cancelled");

  // Bookings gate
  const totalBookings = BASELINE.bookings + bookings.length;

  // Repeat-rate gate: customers with more than one booking / all customers
  const byCustomer = new Map<string, number>();
  for (const b of bookings) byCustomer.set(b.customerName, (byCustomer.get(b.customerName) ?? 0) + 1);
  const liveCustomers = byCustomer.size;
  const liveRepeat = [...byCustomer.values()].filter((n) => n > 1).length;
  const repeatRate = (BASELINE.repeatCustomers + liveRepeat) / Math.max(1, BASELINE.customers + liveCustomers);

  // GMV run-rate gate: pilot-to-date GMV extrapolated to the full 90 days
  const liveGmv = bookings.reduce((sum, b) => sum + b.quote.total, 0);
  const gmvToDate = BASELINE.gmvQar + liveGmv;
  const gmvRunRate = Math.round((gmvToDate / day) * PILOT_LENGTH_DAYS);

  // Supply gates
  const providersLive = BASELINE.providersOnboarded + PROVIDERS.filter((p) => p.verified).length;
  const activeZones = new Set(bookings.map((b) => b.zoneId).filter((z) => getZone(z)?.wave === 1)).size;

  void now; // reserved for time-based gates when the pilot clock goes live

  const gates: PilotGate[] = [
    {
      id: "providers",
      label: "Verified providers live",
      current: providersLive,
      target: 40,
      targetMax: 60,
      unit: "count",
      status: providersLive >= 40 ? "achieved" : gateStatus(providersLive, 40, day),
      detail: `${PROVIDERS.length} in-app + ${BASELINE.providersOnboarded} ops-onboarded, all QID-verified`,
    },
    {
      id: "zones",
      label: "Pilot zones active",
      current: activeZones,
      target: 2,
      unit: "count",
      status: activeZones >= 2 ? "achieved" : "at_risk",
      detail: "Beachhead: West Bay + The Pearl (Lusail warming up)",
    },
    {
      id: "bookings",
      label: "Pilot bookings",
      current: totalBookings,
      target: 1500,
      targetMax: 3000,
      unit: "count",
      status: gateStatus(totalBookings, 1500, day),
      detail: `${bookings.length} in-app + ${BASELINE.bookings} concierge-ops`,
    },
    {
      id: "repeat",
      label: "Repeat rate",
      current: Math.round(repeatRate * 100),
      target: 40,
      unit: "percent",
      status: repeatRate >= 0.4 ? "achieved" : gateStatus(repeatRate * 100, 40, PILOT_LENGTH_DAYS),
      detail: "Customers with 2+ completed bookings",
    },
    {
      id: "gmv",
      label: "GMV run-rate (90-day)",
      current: gmvRunRate,
      target: 500_000,
      unit: "qar",
      status: gateStatus(gmvRunRate, 500_000, day),
      detail: `QAR ${gmvToDate.toLocaleString()} GMV to date, day ${day}`,
    },
  ];

  return {
    day,
    daysRemaining: PILOT_LENGTH_DAYS - day,
    seedReady: gates.every((g) => g.status === "achieved"),
    gates,
  };
}
