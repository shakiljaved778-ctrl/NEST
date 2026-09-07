import { NextResponse } from "next/server";
import { site } from "@/data/content";

/**
 * Receives a project brief from the /start wizard and emails it to the studio.
 *
 * Uses Resend if RESEND_API_KEY is set. If no key is configured, the endpoint
 * still returns 200 so the client always gets its confirmation + WhatsApp
 * fallback — the build is never blocked waiting for API keys.
 *
 * TODO: ADD KEY — set RESEND_API_KEY and BRIEF_TO_EMAIL in your environment.
 * See SETUP.md.
 */

export const runtime = "nodejs";

export async function POST(req: Request) {
  let payload: { summary?: string; businessName?: string; email?: string } = {};
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const summary = payload.summary ?? "(no summary provided)";
  const businessName = payload.businessName || "New enquiry";
  const replyTo = payload.email;

  const apiKey = process.env.RESEND_API_KEY;
  const to = process.env.BRIEF_TO_EMAIL || site.email;
  // TODO: verify a sending domain in Resend and set BRIEF_FROM_EMAIL.
  const from = process.env.BRIEF_FROM_EMAIL || "QatarStore <onboarding@resend.dev>";

  if (!apiKey) {
    // No key configured yet — log and acknowledge. Client shows WhatsApp fallback.
    console.log(`[brief] RESEND_API_KEY not set. Brief for "${businessName}":\n${summary}`);
    return NextResponse.json({ ok: true, delivered: false, reason: "no-key" });
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [to],
        reply_to: replyTo,
        subject: `New project brief — ${businessName}`,
        text: summary,
      }),
    });

    if (!res.ok) {
      const detail = await res.text();
      console.error("[brief] Resend error:", detail);
      return NextResponse.json({ ok: true, delivered: false, reason: "provider-error" });
    }

    return NextResponse.json({ ok: true, delivered: true });
  } catch (err) {
    console.error("[brief] send failed:", err);
    // Still acknowledge — the wizard's WhatsApp fallback covers delivery.
    return NextResponse.json({ ok: true, delivered: false, reason: "exception" });
  }
}
