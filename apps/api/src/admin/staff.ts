import { consoleUserId, type PrismaClient } from "@amil/db";
import { notFound } from "../errors";
import type { ConsoleUser } from "./guard";
import { ConsoleValidationError } from "./packs";
import type { ConsoleRole } from "./rbac";

/**
 * Console staff (D-081). Okta proves who someone is; this list decides whether they may sign in
 * and with which role (D-077). Only admins change it, never their own entry, and the bank always
 * keeps an active compliance officer, since only compliance approves parameters and copy and
 * restarts kill switches. Every change is in the approval log; deactivation applies to the next
 * request, because the console re-reads the user on each one.
 */
type Row = Awaited<ReturnType<PrismaClient["consoleUser"]["findMany"]>>[number];

const view = (u: Row) => ({
  id: u.id,
  name: u.name,
  email: u.email,
  role: u.role,
  active: u.active,
  createdAt: u.createdAt.toISOString(),
});

export async function listStaff(prisma: PrismaClient, bankId: string) {
  const rows = await prisma.consoleUser.findMany({
    where: { bankId },
    orderBy: [{ active: "desc" }, { email: "asc" }],
  });
  return rows.map(view);
}

export async function addStaff(
  prisma: PrismaClient,
  user: ConsoleUser,
  body: { email: string; name: string; role: ConsoleRole },
  now: Date,
) {
  const email = body.email.toLowerCase();
  const existing = await prisma.consoleUser.findFirst({ where: { bankId: user.bankId, email } });
  if (existing)
    throw new ConsoleValidationError("email_exists", [
      { path: "email", message: `${email} is already on the staff list` },
    ]);
  const id = consoleUserId(user.bankId, email);
  const [row] = await prisma.$transaction([
    prisma.consoleUser.create({
      data: { id, bankId: user.bankId, email, name: body.name, role: body.role },
    }),
    prisma.approvalLog.create({
      data: {
        bankId: user.bankId,
        entityType: "console_user",
        entityId: id,
        action: "added",
        toStatus: body.role,
        actorId: user.id,
        at: now,
      },
    }),
  ]);
  return view(row);
}

export async function updateStaff(
  prisma: PrismaClient,
  user: ConsoleUser,
  id: string,
  body: { role?: ConsoleRole | undefined; active?: boolean | undefined; comment: string },
  now: Date,
) {
  const target = await prisma.consoleUser.findFirst({ where: { id, bankId: user.bankId } });
  if (!target) throw notFound();
  if (target.id === user.id)
    throw new ConsoleValidationError("self_change", [
      { path: "id", message: "Ask another admin to change your own access" },
    ]);
  const role = body.role ?? target.role;
  const active = body.active ?? target.active;
  if (role === target.role && active === target.active)
    throw new ConsoleValidationError("no_change", []);

  const losesCompliance =
    target.role === "compliance" && target.active && (role !== "compliance" || !active);
  if (losesCompliance) {
    const others = await prisma.consoleUser.count({
      where: { bankId: user.bankId, role: "compliance", active: true, id: { not: target.id } },
    });
    if (others === 0)
      throw new ConsoleValidationError("last_compliance", [
        { path: "role", message: "The bank must keep at least one active compliance officer" },
      ]);
  }

  const log = (action: string, fromStatus: string, toStatus: string) =>
    prisma.approvalLog.create({
      data: {
        bankId: user.bankId,
        entityType: "console_user",
        entityId: target.id,
        action,
        fromStatus,
        toStatus,
        actorId: user.id,
        comment: body.comment,
        at: now,
      },
    });
  const [row] = await prisma.$transaction([
    prisma.consoleUser.update({ where: { id: target.id }, data: { role, active } }),
    ...(role !== target.role ? [log("role_changed", target.role, role)] : []),
    ...(active !== target.active
      ? [log(active ? "reactivated" : "deactivated", String(target.active), String(active))]
      : []),
  ]);
  return view(row);
}
