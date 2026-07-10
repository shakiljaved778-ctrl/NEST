import { beforeEach, describe, expect, it } from "vitest";
import { buildQuote } from "../lib/pricing";
import { createBooking, getBooking, listBookings, marketplaceStats, updateBookingStatus } from "../lib/store";

// Reset the in-memory store between tests so seed data is deterministic.
beforeEach(() => {
  globalThis.__nestBookings = undefined;
});

function newBookingInput() {
  return {
    serviceId: "house-cleaning",
    packageId: "hc-2h",
    addonIds: [],
    zoneId: "west-bay" as const,
    address: "Zone 61, Street 850, Building 9, Apt 3",
    date: new Date().toISOString().slice(0, 10),
    slot: "10:00",
    urgent: false,
    paymentMethod: "card",
    quote: buildQuote({ serviceId: "house-cleaning", packageId: "hc-2h", slot: "10:00" }),
    providerId: undefined,
    customerName: "Test Customer",
    language: "en" as const,
  };
}

describe("booking store", () => {
  it("seeds the demo marketplace", () => {
    expect(listBookings().length).toBeGreaterThanOrEqual(10);
  });

  it("creates a booking pending match when no provider is set", () => {
    const b = createBooking(newBookingInput());
    expect(b.id).toMatch(/^NB-\d+$/);
    expect(b.status).toBe("pending_match");
    expect(getBooking(b.id)?.customerName).toBe("Test Customer");
  });

  it("creates a booking as matched when a provider is assigned", () => {
    const b = createBooking({ ...newBookingInput(), providerId: "p2" });
    expect(b.status).toBe("matched");
  });

  it("assigns unique sequential ids", () => {
    const a = createBooking(newBookingInput());
    const b = createBooking(newBookingInput());
    expect(a.id).not.toBe(b.id);
  });

  it("walks the golden path: match → accept → en_route → in_progress → complete → rate", () => {
    const b = createBooking({ ...newBookingInput(), providerId: "p1" });
    for (const status of ["accepted", "en_route", "arrived", "in_progress"] as const) {
      expect(updateBookingStatus(b.id, status)?.status).toBe(status);
    }
    const done = updateBookingStatus(b.id, "completed", 5);
    expect(done?.status).toBe("completed");
    expect(done?.rating).toBe(5);
  });

  it("returns undefined for unknown booking ids", () => {
    expect(getBooking("NB-does-not-exist")).toBeUndefined();
    expect(updateBookingStatus("NB-does-not-exist", "cancelled")).toBeUndefined();
  });

  it("lists bookings sorted newest first and includes new bookings", () => {
    const b = createBooking(newBookingInput());
    const list = listBookings();
    expect(list.some((x) => x.id === b.id)).toBe(true);
    for (let i = 1; i < list.length; i++) {
      expect(list[i - 1].createdAt >= list[i].createdAt).toBe(true);
    }
  });

  it("computes marketplace stats used by the pilot scoreboard", () => {
    const s = marketplaceStats();
    expect(s.bookingsToday).toBeGreaterThan(0);
    expect(s.gmvToday).toBeGreaterThan(0);
    expect(s.completionRate).toBeGreaterThan(0);
    expect(s.completionRate).toBeLessThanOrEqual(1);
    expect(s.activeProviders).toBe(12);
  });
});
