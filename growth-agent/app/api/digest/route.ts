import { NextResponse } from "next/server";
import nodemailer from "nodemailer";
import { buildDigest } from "@/lib/emailDigest";
import { readStore } from "@/lib/serverStore";
import { DailyCheckin, Goals } from "@/lib/types";

/**
 * POST /api/digest — build today's briefing email and send it to the
 * configured address (goals.email, default shakil.mdj@outlook.com).
 *
 * SMTP comes from env vars (see README): SMTP_HOST, SMTP_PORT, SMTP_USER,
 * SMTP_PASS, DIGEST_FROM. Without them the digest is still returned in the
 * response ({ sent: false, digest }) so the app can preview it.
 *
 * The body may optionally carry { goals, history } from the browser so the
 * digest reflects the latest check-ins even if the server store is stale.
 */
export async function POST(req: Request) {
  let bodyGoals: Goals | undefined;
  let bodyHistory: DailyCheckin[] | undefined;
  try {
    const body = (await req.json()) as { goals?: Goals; history?: DailyCheckin[] };
    bodyGoals = body.goals;
    bodyHistory = Array.isArray(body.history) ? body.history : undefined;
  } catch {
    // empty body is fine — fall back to the server store (cron path)
  }

  const store = await readStore();
  const goals = bodyGoals ?? store.goals;
  const history = bodyHistory ?? store.history;
  const today = new Date().toISOString().slice(0, 10);

  const digest = buildDigest(goals, history, today);
  const to = goals.email;

  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, DIGEST_FROM } = process.env;
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) {
    return NextResponse.json({
      sent: false,
      to,
      reason: "SMTP not configured (set SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS)",
      digest,
    });
  }

  try {
    const transporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port: Number(SMTP_PORT ?? 587),
      secure: Number(SMTP_PORT ?? 587) === 465,
      auth: { user: SMTP_USER, pass: SMTP_PASS },
    });
    await transporter.sendMail({
      from: DIGEST_FROM ?? SMTP_USER,
      to,
      subject: digest.subject,
      text: digest.text,
      html: digest.html,
    });
    return NextResponse.json({ sent: true, to, digest });
  } catch (err) {
    return NextResponse.json(
      { sent: false, to, reason: err instanceof Error ? err.message : "send failed", digest },
      { status: 502 }
    );
  }
}

/** GET works too, so a simple cron `curl` can trigger the daily email. */
export async function GET() {
  return POST(new Request("http://localhost/api/digest", { method: "POST" }));
}
