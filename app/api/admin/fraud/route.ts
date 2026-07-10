import { NextResponse } from "next/server";
import { detectFraud } from "@/lib/fraud";
import { listPayments, listRefunds } from "@/lib/payments";
import { listBookings } from "@/lib/store";

/** GET /api/admin/fraud — live fraud scan over marketplace data. */
export function GET() {
  const flags = detectFraud({
    bookings: listBookings(),
    payments: listPayments(),
    refunds: listRefunds(),
  });
  return NextResponse.json({ flags, scannedAt: new Date().toISOString() });
}
