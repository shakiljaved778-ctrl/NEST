import { buildQuote } from "./pricing";
import type { Booking, BookingStatus } from "./types";

/**
 * In-memory data store for the MVP demo (survives across requests in one
 * server process). Production swaps this for PostgreSQL via Prisma —
 * see prisma/schema.prisma.
 */

declare global {
  // eslint-disable-next-line no-var
  var __nestBookings: Booking[] | undefined;
}

function seedBookings(): Booking[] {
  const mk = (
    id: string,
    serviceId: string,
    packageId: string,
    zoneId: Booking["zoneId"],
    status: BookingStatus,
    customerName: string,
    daysAgo: number,
    slot: string,
    rating?: number,
  ): Booking => {
    const date = new Date();
    date.setDate(date.getDate() - daysAgo);
    return {
      id,
      serviceId,
      packageId,
      addonIds: [],
      zoneId,
      address: "Tower 12, Apt 804",
      date: date.toISOString().slice(0, 10),
      slot,
      urgent: false,
      paymentMethod: "card",
      quote: buildQuote({ serviceId, packageId, slot }),
      providerId: undefined,
      status,
      customerName,
      language: "en",
      rating,
      createdAt: date.toISOString(),
    };
  };

  return [
    mk("NB-1041", "ac-technician", "ac-service", "west-bay", "in_progress", "Sara Al-Kuwari", 0, "10:00"),
    mk("NB-1040", "house-cleaning", "hc-2h", "the-pearl", "en_route", "James Wilson", 0, "09:30"),
    mk("NB-1039", "deep-cleaning", "dc-2br", "lusail", "accepted", "Ayesha Rahman", 0, "14:00"),
    mk("NB-1038", "plumbing", "pl-leak", "al-sadd", "pending_match", "Mohammed Al-Thani", 0, "18:00"),
    mk("NB-1037", "salon", "sl-mani", "the-pearl", "completed", "Elena Petrova", 1, "16:00", 5),
    mk("NB-1036", "pest-control", "pc-apt", "al-wakrah", "completed", "Ravi Menon", 1, "11:00", 4),
    mk("NB-1035", "electrical", "el-fixture", "west-bay", "completed", "Fatima Noor", 2, "19:00", 5),
    mk("NB-1034", "car-wash", "cw-full", "lusail", "cancelled", "Daniel Reyes", 2, "08:00"),
    mk("NB-1033", "nanny", "nn-4h", "the-pearl", "completed", "Hannah Lee", 3, "13:00", 5),
    mk("NB-1032", "ac-technician", "ac-deep", "al-rayyan", "completed", "Omar Farouk", 3, "17:30", 4),
  ];
}

function bookings(): Booking[] {
  if (!globalThis.__nestBookings) globalThis.__nestBookings = seedBookings();
  return globalThis.__nestBookings;
}

export function listBookings(): Booking[] {
  return [...bookings()].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}

export function getBooking(id: string): Booking | undefined {
  return bookings().find((b) => b.id === id);
}

export function createBooking(input: Omit<Booking, "id" | "createdAt" | "status">): Booking {
  const id = `NB-${1042 + bookings().filter((b) => b.id.startsWith("NB-")).length}`;
  const booking: Booking = {
    ...input,
    id,
    status: input.providerId ? "matched" : "pending_match",
    createdAt: new Date().toISOString(),
  };
  bookings().unshift(booking);
  return booking;
}

export function updateBookingStatus(id: string, status: BookingStatus, rating?: number): Booking | undefined {
  const b = getBooking(id);
  if (!b) return undefined;
  b.status = status;
  if (rating !== undefined) b.rating = rating;
  return b;
}

export function marketplaceStats() {
  const all = bookings();
  const today = new Date().toISOString().slice(0, 10);
  const todays = all.filter((b) => b.date === today && b.status !== "cancelled");
  const completed = all.filter((b) => b.status === "completed");
  return {
    bookingsToday: todays.length,
    gmvToday: todays.reduce((s, b) => s + b.quote.total, 0),
    completionRate: completed.length / Math.max(1, all.filter((b) => b.status !== "cancelled").length - todays.length + completed.length),
    openComplaints: 3,
    activeProviders: 12,
    avgRating: completed.filter((b) => b.rating).reduce((s, b) => s + (b.rating ?? 0), 0) / Math.max(1, completed.filter((b) => b.rating).length),
  };
}
