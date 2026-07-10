import { NextRequest, NextResponse } from "next/server";
import { createRefund } from "@/lib/payments";

/** POST /api/refunds — partial or full refund against a captured payment. */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    if (!body.paymentId || body.amount === undefined) {
      return NextResponse.json({ error: "paymentId and amount are required" }, { status: 400 });
    }
    const refund = createRefund(String(body.paymentId), Number(body.amount), String(body.reason ?? ""));
    return NextResponse.json({ refund }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
}
