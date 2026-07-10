import { NextRequest, NextResponse } from "next/server";
import { createPaymentIntent } from "@/lib/payments";

/** POST /api/payments/intent — create (or return) the payment intent for a booking. */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    if (!body.bookingId) {
      return NextResponse.json({ error: "bookingId is required" }, { status: 400 });
    }
    const payment = createPaymentIntent(String(body.bookingId), body.method);
    return NextResponse.json({ payment }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
}
