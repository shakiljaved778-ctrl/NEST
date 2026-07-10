import { NextRequest, NextResponse } from "next/server";
import { captureForBooking } from "@/lib/payments";
import { getBooking, updateBookingStatus } from "@/lib/store";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const booking = getBooking(id);
  if (!booking) return NextResponse.json({ error: "Booking not found" }, { status: 404 });
  return NextResponse.json({ booking });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  const booking = updateBookingStatus(id, body.status, body.rating);
  if (!booking) return NextResponse.json({ error: "Booking not found" }, { status: 404 });
  // Pre-auth → capture on completion: charge held funds and issue the e-invoice.
  const payment = body.status === "completed" ? captureForBooking(id) : undefined;
  return NextResponse.json(payment ? { booking, payment } : { booking });
}
