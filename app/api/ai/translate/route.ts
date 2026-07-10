import { NextRequest, NextResponse } from "next/server";
import { translateMessage } from "@/lib/translate";

/** POST /api/ai/translate — real-time chat translation across the 6 pilot languages. */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    if (!body.message || !body.targetLang) {
      return NextResponse.json({ error: "message and targetLang are required" }, { status: 400 });
    }
    const result = translateMessage(String(body.message), body.targetLang, body.sourceLang);
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
}
