import { NextRequest, NextResponse } from "next/server";
import { sendMessage, threadFor } from "@/lib/chat";

/** GET /api/chat/:bookingId — the auto-translated message thread. */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ bookingId: string }> }) {
  const { bookingId } = await params;
  return NextResponse.json({ messages: threadFor(bookingId) });
}

/** POST /api/chat/:bookingId — send a message; stored with its translation for the recipient. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ bookingId: string }> }) {
  try {
    const { bookingId } = await params;
    const body = await req.json();
    if (!body.sender || !body.text) {
      return NextResponse.json({ error: "sender and text are required" }, { status: 400 });
    }
    const message = sendMessage({
      bookingId,
      sender: body.sender,
      text: String(body.text),
      recipientLang: body.recipientLang,
    });
    return NextResponse.json({ message }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
}
