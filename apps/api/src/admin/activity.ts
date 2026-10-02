import { hashCustomerRef, type Prisma, type PrismaClient } from "@amil/db";
import type { ConsoleUser } from "./guard";

export type ActivityAction =
  | "sign_in"
  | "audit_search"
  | "audit_event_view"
  | "audit_export"
  | "audit_verify"
  | "complaints_lookup";

/**
 * Record what a staff member looked at (D-068). Changes go to the approval log; this covers
 * sign-ins and customer-level reads and exports. Customer references are stored only as their
 * keyed hash, the same one the audit log uses.
 */
export async function recordActivity(
  prisma: PrismaClient,
  user: Pick<ConsoleUser, "id" | "bankId">,
  action: ActivityAction,
  detail: Record<string, unknown>,
  at: Date,
): Promise<void> {
  await prisma.consoleActivity.create({
    data: {
      bankId: user.bankId,
      actorId: user.id,
      action,
      detail: detail as Prisma.InputJsonValue,
      at,
    },
  });
}

/** Replace a customer reference with its keyed hash before it is logged. */
export function withRefHash<T extends { customerRef?: string | undefined }>(
  secret: string,
  bankId: string,
  q: T,
): Omit<T, "customerRef"> & { customerRefHash?: string } {
  const { customerRef, ...rest } = q;
  return {
    ...rest,
    ...(customerRef ? { customerRefHash: hashCustomerRef(secret, bankId, customerRef) } : {}),
  };
}

/** Recent console activity and changes, newest first, one list (admin and compliance). */
export async function listActivity(prisma: PrismaClient, bankId: string, limit = 100) {
  const [activity, changes] = await Promise.all([
    prisma.consoleActivity.findMany({
      where: { bankId },
      orderBy: [{ at: "desc" }, { id: "desc" }],
      take: limit,
      include: { actor: { select: { name: true, role: true } } },
    }),
    prisma.approvalLog.findMany({
      where: { bankId },
      orderBy: [{ at: "desc" }, { id: "desc" }],
      take: limit,
      include: { actor: { select: { name: true, role: true } } },
    }),
  ]);
  return [
    ...activity.map((a) => ({
      id: a.id,
      kind: "activity" as const,
      action: a.action,
      actor: a.actor.name,
      role: a.actor.role,
      at: a.at.toISOString(),
      detail: a.detail,
    })),
    ...changes.map((c) => ({
      id: c.id,
      kind: "change" as const,
      action: `${c.entityType}.${c.action}`,
      actor: c.actor.name,
      role: c.actor.role,
      at: c.at.toISOString(),
      detail: { entityId: c.entityId, fromStatus: c.fromStatus, toStatus: c.toStatus },
    })),
  ]
    .sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0))
    .slice(0, limit);
}
