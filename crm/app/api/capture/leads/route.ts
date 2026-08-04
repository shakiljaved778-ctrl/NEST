import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { leadCaptureSchema } from "@/lib/validation";
import { rateLimit, clientIp } from "@/lib/ratelimit";
import { routeLead } from "@/lib/services/routing";
import { logAudit } from "@/lib/audit";
import { normalizeEmail } from "@/lib/utils";

// Public lead-capture endpoint. Tokenized per campaign (CaptureToken, kind
// FORM). Accepts JSON or form-encoded posts from the embeddable web form.
export async function POST(req: Request) {
  const ip = clientIp(req);
  if (!rateLimit(`capture:${ip}`, 20, 60_000)) {
    return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
  }

  let raw: Record<string, unknown>;
  const contentType = req.headers.get("content-type") ?? "";
  try {
    if (contentType.includes("application/json")) {
      raw = await req.json();
    } else {
      raw = Object.fromEntries((await req.formData()).entries());
    }
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const parsed = leadCaptureSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed", details: parsed.error.flatten().fieldErrors }, { status: 422 });
  }
  const input = parsed.data;

  // honeypot tripped → pretend success, create nothing
  if (raw.website_url) return NextResponse.json({ ok: true });

  const token = await db.captureToken.findFirst({ where: { token: input.token, kind: "FORM", active: true } });
  if (!token) return NextResponse.json({ error: "Invalid capture token" }, { status: 403 });

  const product = input.productInterest
    ? await db.product.findFirst({
        where: { name: { equals: input.productInterest, mode: "insensitive" }, deletedAt: null },
      })
    : null;

  const lead = await db.lead.create({
    data: {
      firstName: input.firstName,
      lastName: input.lastName,
      company: input.company ?? null,
      email: normalizeEmail(input.email),
      phone: input.phone ?? null,
      source: token.source,
      channel: "web",
      campaign: token.campaign,
      territory: input.territory ?? null,
      productInterestId: product?.id ?? null,
      notes: input.message ?? null,
      lawfulBasis: input.consent ? "CONSENT" : null,
      consentAt: input.consent ? new Date() : null,
    },
  });

  await logAudit({
    action: "CREATE",
    entityType: "LEAD",
    entityId: lead.id,
    entityLabel: `${lead.firstName} ${lead.lastName}`,
    actorEmail: `capture:${token.campaign ?? token.token}`,
    ip,
    after: { source: token.source, campaign: token.campaign },
  });

  await routeLead(lead.id);

  return NextResponse.json({ ok: true, id: lead.id }, { status: 201 });
}
