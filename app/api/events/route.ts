import { NextRequest, NextResponse } from "next/server";
import { trackEvent } from "@/lib/analytics";

/** POST /api/events — track a named-taxonomy analytics event. */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    if (!body.name || !body.actor) {
      return NextResponse.json({ error: "name and actor are required" }, { status: 400 });
    }
    const event = trackEvent(String(body.name), String(body.actor), body.properties ?? {});
    return NextResponse.json({ event }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
}
