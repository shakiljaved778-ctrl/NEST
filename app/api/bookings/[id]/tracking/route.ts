import { NextRequest, NextResponse } from "next/server";
import { trackBooking } from "@/lib/tracking";

/** GET /api/bookings/:id/tracking — live-tracking snapshot (production: WebSocket push). */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    return NextResponse.json(trackBooking(id));
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 404 });
  }
}
