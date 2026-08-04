import { db } from "@/lib/db";
import { AuthError } from "@/lib/auth";
import { assertWrite, seesAll, type SessionUser } from "@/lib/rbac";
import { logAudit } from "@/lib/audit";
import type { z } from "zod";
import type { taskCreateSchema } from "@/lib/validation";

export async function createTask(user: SessionUser, input: z.infer<typeof taskCreateSchema>) {
  assertWrite(user);
  const task = await db.task.create({
    data: {
      title: input.title,
      description: input.description ?? null,
      dueAt: input.dueAt,
      priority: input.priority,
      ownerId: input.ownerId || user.id,
      createdById: user.id,
      leadId: input.leadId ?? null,
      accountId: input.accountId ?? null,
      contactId: input.contactId ?? null,
      dealId: input.dealId ?? null,
      recurrence: input.recurrence ?? undefined,
    },
  });
  await logAudit({
    action: "CREATE", entityType: "TASK", entityId: task.id, entityLabel: task.title,
    actorId: user.id, actorEmail: user.email, after: { dueAt: task.dueAt.toISOString(), ownerId: task.ownerId },
  });
  return task;
}

async function assertTaskAccess(user: SessionUser, taskId: string) {
  const task = await db.task.findFirst({ where: { id: taskId, deletedAt: null } });
  if (!task) throw new AuthError("Not found");
  if (task.ownerId !== user.id && task.createdById !== user.id && !seesAll(user.role) && user.role !== "TEAM_LEAD") {
    throw new AuthError("Forbidden");
  }
  if (user.role === "TEAM_LEAD" && task.ownerId !== user.id && task.createdById !== user.id) {
    const owner = await db.user.findUnique({ where: { id: task.ownerId }, select: { teamId: true } });
    if (owner?.teamId !== user.teamId) throw new AuthError("Forbidden");
  }
  return task;
}

/** Complete a task; recurring tasks spawn their next occurrence. */
export async function completeTask(user: SessionUser, taskId: string) {
  assertWrite(user);
  const task = await assertTaskAccess(user, taskId);
  if (task.status === "DONE") return task;

  const updated = await db.task.update({
    where: { id: taskId },
    data: { status: "DONE", completedAt: new Date() },
  });

  const rec = task.recurrence as { freq?: "DAILY" | "WEEKLY" | "MONTHLY"; interval?: number } | null;
  if (rec?.freq) {
    const interval = rec.interval ?? 1;
    const next = new Date(task.dueAt);
    if (rec.freq === "DAILY") next.setUTCDate(next.getUTCDate() + interval);
    if (rec.freq === "WEEKLY") next.setUTCDate(next.getUTCDate() + 7 * interval);
    if (rec.freq === "MONTHLY") next.setUTCMonth(next.getUTCMonth() + interval);
    // keep the next occurrence in the future
    while (next < new Date()) {
      if (rec.freq === "DAILY") next.setUTCDate(next.getUTCDate() + interval);
      if (rec.freq === "WEEKLY") next.setUTCDate(next.getUTCDate() + 7 * interval);
      if (rec.freq === "MONTHLY") next.setUTCMonth(next.getUTCMonth() + interval);
    }
    await db.task.create({
      data: {
        title: task.title,
        description: task.description,
        dueAt: next,
        priority: task.priority,
        ownerId: task.ownerId,
        createdById: task.createdById,
        leadId: task.leadId,
        accountId: task.accountId,
        contactId: task.contactId,
        dealId: task.dealId,
        recurrence: task.recurrence ?? undefined,
      },
    });
  }

  await logAudit({
    action: "UPDATE", entityType: "TASK", entityId: taskId, entityLabel: task.title,
    actorId: user.id, actorEmail: user.email, after: { status: "DONE" },
  });
  return updated;
}

export async function reopenTask(user: SessionUser, taskId: string) {
  assertWrite(user);
  const task = await assertTaskAccess(user, taskId);
  return db.task.update({ where: { id: task.id }, data: { status: "OPEN", completedAt: null } });
}

export async function deleteTask(user: SessionUser, taskId: string) {
  assertWrite(user);
  const task = await assertTaskAccess(user, taskId);
  await db.task.update({ where: { id: task.id }, data: { deletedAt: new Date() } });
  await logAudit({
    action: "DELETE", entityType: "TASK", entityId: taskId, entityLabel: task.title,
    actorId: user.id, actorEmail: user.email,
  });
}
