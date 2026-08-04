"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { assertWrite } from "@/lib/rbac";
import { logAudit } from "@/lib/audit";
import { normalizeEmail, normalizePhone } from "@/lib/utils";
import { routeLead } from "@/lib/services/routing";

const importRowSchema = z.object({
  firstName: z.string().trim().min(1).max(100),
  lastName: z.string().trim().min(1).max(100),
  company: z.string().trim().max(200).optional(),
  email: z.string().trim().max(200).optional(),
  phone: z.string().trim().max(30).optional(),
  source: z.string().trim().max(50).optional(),
  campaign: z.string().trim().max(100).optional(),
  territory: z.string().trim().max(100).optional(),
  score: z.coerce.number().int().min(0).max(100).optional(),
});

export type ImportRowResult = {
  row: number;
  status: "created" | "duplicate" | "error";
  message?: string;
  id?: string;
};

export async function importLeadsAction(
  rows: Record<string, string>[],
  options: { skipDuplicates: boolean; autoRoute: boolean }
): Promise<{ results: ImportRowResult[] }> {
  const user = await requireUser();
  assertWrite(user);
  if (rows.length > 2000) throw new Error("Import is limited to 2,000 rows per batch");

  const results: ImportRowResult[] = [];

  // Pre-load existing emails/phones for duplicate detection in one pass
  const emails = rows.map((r) => normalizeEmail(r.email)).filter(Boolean) as string[];
  const phones = rows.map((r) => normalizePhone(r.phone)).filter(Boolean) as string[];
  const existing = await db.lead.findMany({
    where: {
      deletedAt: null,
      OR: [
        ...(emails.length ? [{ email: { in: emails } }] : []),
        ...(phones.length ? [{ phone: { not: null } }] : []),
      ],
    },
    select: { email: true, phone: true },
  });
  const existingEmails = new Set(existing.map((l) => l.email).filter(Boolean));
  const existingPhones = new Set(existing.map((l) => normalizePhone(l.phone)).filter(Boolean));
  const seenInBatch = new Set<string>();

  for (let i = 0; i < rows.length; i++) {
    const parsed = importRowSchema.safeParse(rows[i]);
    if (!parsed.success) {
      const issues = parsed.error.issues.map((iss) => `${iss.path.join(".")}: ${iss.message}`).join("; ");
      results.push({ row: i + 1, status: "error", message: issues });
      continue;
    }
    const r = parsed.data;
    const email = normalizeEmail(r.email);
    const phone = normalizePhone(r.phone);
    const dupKey = email ?? phone ?? "";
    const isDup =
      (email && existingEmails.has(email)) ||
      (phone && existingPhones.has(phone)) ||
      (dupKey && seenInBatch.has(dupKey));

    if (isDup && options.skipDuplicates) {
      results.push({ row: i + 1, status: "duplicate", message: `Matches existing lead by ${email && existingEmails.has(email) ? "email" : "phone"}` });
      continue;
    }
    if (dupKey) seenInBatch.add(dupKey);

    try {
      const lead = await db.lead.create({
        data: {
          firstName: r.firstName,
          lastName: r.lastName,
          company: r.company || null,
          email,
          phone: r.phone || null,
          source: r.source || "csv-import",
          campaign: r.campaign || null,
          territory: r.territory || null,
          score: r.score ?? 0,
          ownerId: options.autoRoute ? null : user.id,
          teamId: options.autoRoute ? null : user.teamId,
        },
      });
      if (options.autoRoute) await routeLead(lead.id);
      results.push({ row: i + 1, status: isDup ? "duplicate" : "created", id: lead.id, message: isDup ? "Created anyway (duplicate match)" : undefined });
    } catch (e) {
      results.push({ row: i + 1, status: "error", message: e instanceof Error ? e.message : "DB error" });
    }
  }

  await logAudit({
    action: "CREATE",
    entityType: "LEAD",
    actorId: user.id,
    actorEmail: user.email,
    entityLabel: "CSV import",
    after: {
      total: rows.length,
      created: results.filter((r) => r.status === "created").length,
      duplicates: results.filter((r) => r.status === "duplicate").length,
      errors: results.filter((r) => r.status === "error").length,
    },
  });

  revalidatePath("/leads");
  return { results };
}
