import { NextRequest, NextResponse } from "next/server";
import { classifyComplaint } from "@/lib/ai";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    if (!body.text) {
      return NextResponse.json({ error: "text is required" }, { status: 400 });
    }
    return NextResponse.json(classifyComplaint(String(body.text)));
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
}
