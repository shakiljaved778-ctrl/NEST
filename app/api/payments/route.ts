import { NextResponse } from "next/server";
import { listPayments, listRefunds } from "@/lib/payments";

/** GET /api/payments — payments + refunds ledger (admin). */
export function GET() {
  return NextResponse.json({ payments: listPayments(), refunds: listRefunds() });
}
