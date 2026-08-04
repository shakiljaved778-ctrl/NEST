import { db } from "@/lib/db";
import { assertWrite, type SessionUser } from "@/lib/rbac";
import { logAudit } from "@/lib/audit";
import { stampFirstTouch } from "@/lib/services/leads";
import type { z } from "zod";
import type { activityCreateSchema } from "@/lib/validation";

export async function logActivity(user: SessionUser, input: z.infer<typeof activityCreateSchema>) {
  assertWrite(user);
  const activity = await db.activity.create({
    data: {
      type: input.type,
      subject: input.subject,
      body: input.body ?? null,
      occurredAt: input.occurredAt ?? new Date(),
      userId: user.id,
      leadId: input.leadId ?? null,
      accountId: input.accountId ?? null,
      contactId: input.contactId ?? null,
      dealId: input.dealId ?? null,
    },
  });
  await logAudit({
    action: "CREATE",
    entityType: "ACTIVITY",
    entityId: activity.id,
    entityLabel: activity.subject,
    actorId: user.id,
    actorEmail: user.email,
    after: { type: activity.type, leadId: activity.leadId, dealId: activity.dealId },
  });
  // logging a call/note against a NEW lead counts as first touch (SLA)
  if (input.leadId) await stampFirstTouch(input.leadId);
  return activity;
}
