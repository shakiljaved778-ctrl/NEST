import { NextResponse } from "next/server";
import { adminDailySummary } from "@/lib/ai";
import { getService } from "@/lib/catalog";
import { listBookings, marketplaceStats } from "@/lib/store";

export function GET() {
  const stats = marketplaceStats();
  const bookings = listBookings();

  // Most-booked service today for the AI summary
  const counts = new Map<string, number>();
  for (const b of bookings) counts.set(b.serviceId, (counts.get(b.serviceId) ?? 0) + 1);
  const topServiceId = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "house-cleaning";

  const summary = adminDailySummary({
    bookingsToday: stats.bookingsToday,
    gmvToday: stats.gmvToday,
    completionRate: Number.isFinite(stats.completionRate) ? Math.min(stats.completionRate, 1) : 0.95,
    openComplaints: stats.openComplaints,
    topService: getService(topServiceId)?.name ?? "House cleaning",
    hotZone: "West Bay",
  });

  return NextResponse.json({ stats, summary });
}
