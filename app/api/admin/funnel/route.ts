import { NextResponse } from "next/server";
import { funnelReview } from "@/lib/analytics";

/** GET /api/admin/funnel — weekly booking-funnel review (>20% drop ⇒ kill or fix). */
export function GET() {
  return NextResponse.json(funnelReview());
}
