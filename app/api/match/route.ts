import { NextRequest, NextResponse } from "next/server";
import { matchProviders } from "@/lib/providers";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    if (!body.serviceId || !body.zoneId) {
      return NextResponse.json({ error: "serviceId and zoneId are required" }, { status: 400 });
    }
    const matches = matchProviders(body);
    return NextResponse.json({ matches });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
}
