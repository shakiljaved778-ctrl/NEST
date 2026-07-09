import { NextRequest, NextResponse } from "next/server";
import { buildQuote } from "@/lib/pricing";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    if (!body.serviceId || !body.packageId) {
      return NextResponse.json({ error: "serviceId and packageId are required" }, { status: 400 });
    }
    const quote = buildQuote(body);
    return NextResponse.json({ quote });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
}
