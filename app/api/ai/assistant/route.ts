import { NextRequest, NextResponse } from "next/server";
import { bookingAssistant } from "@/lib/ai";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    if (!body.message) {
      return NextResponse.json({ error: "message is required" }, { status: 400 });
    }
    const result = bookingAssistant(String(body.message), body.language);
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
}
