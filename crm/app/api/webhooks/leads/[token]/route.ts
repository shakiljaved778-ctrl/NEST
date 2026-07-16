import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { rateLimit, clientIp } from "@/lib/ratelimit";
import { routeLead } from "@/lib/services/routing";
import { logAudit } from "@/lib/audit";
import { normalizeEmail } from "@/lib/utils";

// Generic inbound webhook for third-party form tools (Typeform, HubSpot forms,
// Zapier, …). Field names are matched loosely so most payloads work without
// mapping. Authenticated by the token in the URL (CaptureToken, kind WEBHOOK).

const webhookSchema = z
  .object({
    first_name: z.string().optional(), firstName: z.string().optional(), name: z.string().optional(),
    last_name: z.string().optional(), lastName: z.string().optional(),
    email: z.string().optional(),
    phone: z.string().optional(), mobile: z.string().optional(),
    company: z.string().optional(), organization: z.string().optional(),
    territory: z.string().optional(), city: z.string().optional(),
    campaign: z.string().optional(),
    message: z.string().optional(), notes: z.string().optional(),
    consent: z.union([z.boolean(), z.string()]).optional(),
    score: z.coerce.number().int().min(0).max(100).optional(),
  })
  .passthrough();

export async function POST(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const ip = clientIp(req);
  if (!rateLimit(`webhook:${ip}`, 60, 60_000)) {
    return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
  }

  const { token: tokenValue } = await params;
  const token = await db.captureToken.findFirst({ where: { token: tokenValue, kind: "WEBHOOK", active: true } });
  if (!token) return NextResponse.json({ error: "Invalid webhook token" }, { status: 403 });

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: "Body must be JSON" }, { status: 400 });
  }
  const parsed = webhookSchema.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ error: "Validation failed" }, { status: 422 });
  const d = parsed.data;

  let firstName = d.first_name ?? d.firstName ?? "";
  let lastName = d.last_name ?? d.lastName ?? "";
  if (!firstName && d.name) {
    const parts = d.name.trim().split(/\s+/);
    firstName = parts[0];
    lastName = parts.slice(1).join(" ") || "—";
  }
  if (!firstName) return NextResponse.json({ error: "A name is required" }, { status: 422 });
  const consent = d.consent === true || d.consent === "true" || d.consent === "yes" || d.consent === "1";

  const lead = await db.lead.create({
    data: {
      firstName,
      lastName: lastName || "—",
      company: d.company ?? d.organization ?? null,
      email: normalizeEmail(d.email),
      phone: d.phone ?? d.mobile ?? null,
      source: token.source,
      channel: "webhook",
      campaign: d.campaign ?? token.campaign,
      territory: d.territory ?? d.city ?? null,
      score: d.score ?? 0,
      notes: d.message ?? d.notes ?? null,
      lawfulBasis: consent ? "CONSENT" : null,
      consentAt: consent ? new Date() : null,
    },
  });

  await logAudit({
    action: "CREATE",
    entityType: "LEAD",
    entityId: lead.id,
    entityLabel: `${firstName} ${lastName}`,
    actorEmail: `webhook:${token.token}`,
    ip,
    after: { source: token.source },
  });

  await routeLead(lead.id);
  return NextResponse.json({ ok: true, id: lead.id }, { status: 201 });
}
