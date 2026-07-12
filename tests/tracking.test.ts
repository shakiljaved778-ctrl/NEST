import { beforeEach, describe, expect, it } from "vitest";
import { trackBooking, ZONE_COORDS } from "../lib/tracking";
import { createBooking, updateBookingStatus } from "../lib/store";
import { buildQuote } from "../lib/pricing";
import type { BookingStatus } from "../lib/types";

beforeEach(() => {
  globalThis.__nestBookings = undefined;
});

function makeBooking(status?: BookingStatus) {
  const b = createBooking({
    serviceId: "ac-technician",
    packageId: "ac-service",
    addonIds: [],
    zoneId: "west-bay",
    address: "Tower 12",
    date: new Date().toISOString().slice(0, 10),
    slot: "10:00",
    urgent: false,
    paymentMethod: "card",
    quote: buildQuote({ serviceId: "ac-technician", packageId: "ac-service" }),
    providerId: "p1",
    customerName: "Track Tester",
    language: "en",
  });
  if (status) updateBookingStatus(b.id, status);
  return b;
}

describe("trackBooking", () => {
  it("shows assigning with no position before a provider accepts", () => {
    const b = createBooking({
      serviceId: "plumbing",
      packageId: "pl-visit",
      addonIds: [],
      zoneId: "lusail",
      address: "Marina 21",
      date: new Date().toISOString().slice(0, 10),
      slot: "11:00",
      urgent: false,
      paymentMethod: "card",
      quote: buildQuote({ serviceId: "plumbing", packageId: "pl-visit" }),
      providerId: undefined,
      customerName: "Unassigned",
      language: "en",
    });
    const t = trackBooking(b.id);
    expect(t.phase).toBe("assigning");
    expect(t.position).toBeNull();
    expect(t.etaMinutes).toBeNull();
    expect(t.safetyPanel.providerName).toBeNull();
  });

  it("interpolates position toward the destination while en route", () => {
    const b = makeBooking("en_route");
    const created = new Date(b.createdAt).getTime();
    const early = trackBooking(b.id, created + 2 * 60000); // 2 min in
    const late = trackBooking(b.id, created + 12 * 60000); // 12 min in
    expect(early.phase).toBe("en_route");
    expect(late.progress).toBeGreaterThan(early.progress);
    expect(late.etaMinutes!).toBeLessThan(early.etaMinutes!);

    const dest = ZONE_COORDS["west-bay"];
    const dist = (p: { lat: number; lng: number }) => Math.hypot(p.lat - dest.lat, p.lng - dest.lng);
    expect(dist(late.position!)).toBeLessThan(dist(early.position!));
  });

  it("caps progress at 1 and lands on the destination", () => {
    const b = makeBooking("en_route");
    const t = trackBooking(b.id, new Date(b.createdAt).getTime() + 60 * 60000);
    expect(t.progress).toBe(1);
    expect(t.position).toEqual(ZONE_COORDS["west-bay"]);
  });

  it("shows on-site with zero ETA once arrived or in progress", () => {
    const b = makeBooking("in_progress");
    const t = trackBooking(b.id);
    expect(t.phase).toBe("on_site");
    expect(t.etaMinutes).toBe(0);
    expect(t.position).toEqual(ZONE_COORDS["west-bay"]);
  });

  it("carries the trust-forward safety panel", () => {
    const b = makeBooking("en_route");
    const t = trackBooking(b.id);
    expect(t.safetyPanel.providerName).toBe("Ramesh Kumar");
    expect(t.safetyPanel.verified).toBe(true);
    expect(t.safetyPanel.checks).toContain("QID verified");
    expect(t.safetyPanel.sosNumber).toBe("999");
  });

  it("handles finished and cancelled phases", () => {
    expect(trackBooking(makeBooking("completed").id).phase).toBe("finished");
    const cancelled = trackBooking(makeBooking("cancelled").id);
    expect(cancelled.phase).toBe("cancelled");
    expect(cancelled.position).toBeNull();
  });

  it("throws on unknown bookings", () => {
    expect(() => trackBooking("NB-nope")).toThrow(/Unknown booking/);
  });
});
