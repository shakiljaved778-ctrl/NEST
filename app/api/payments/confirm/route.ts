import { NextRequest, NextResponse } from "next/server";
import { confirmPayment } from "@/lib/payments";

/** POST /api/payments/confirm — pre-authorize: hold funds until job completion. */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    if (!body.paymentId) {
      return NextResponse.json({ error: "paymentId is required" }, { status: 400 });
    }
    const payment = confirmPayment(String(body.paymentId));
    return NextResponse.json({ payment });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
}
