import type { Prisma, Role } from "@prisma/client";
import { db } from "@/lib/db";
import { AuthError } from "@/lib/auth";

// ─── Role predicates ─────────────────────────────────────────────────────────

export type SessionUser = {
  id: string;
  role: Role;
  teamId: string | null;
  territory?: string | null;
  email?: string | null;
  name?: string | null;
};

/** Sees all sales data (read). */
export function seesAll(role: Role): boolean {
  return role === "ADMIN" || role === "MANAGER" || role === "READ_ONLY";
}

/** Can mutate records at all. READ_ONLY (Compliance/Finance) never writes. */
export function canWrite(role: Role): boolean {
  return role !== "READ_ONLY";
}

export function isManagerial(role: Role): boolean {
  return role === "ADMIN" || role === "MANAGER";
}

export function isAdmin(role: Role): boolean {
  return role === "ADMIN";
}

export function assertWrite(user: SessionUser): void {
  if (!canWrite(user.role)) throw new AuthError("Read-only role cannot modify records");
}

export function assertManagerial(user: SessionUser): void {
  if (!isManagerial(user.role)) throw new AuthError("Requires manager or admin role");
}

export function assertAdmin(user: SessionUser): void {
  if (!isAdmin(user.role)) throw new AuthError("Requires admin role");
}

// ─── Row-level scope filters (Prisma where fragments) ────────────────────────
// Every list/detail query composes one of these server-side; the UI never
// enforces visibility on its own.

async function teamMemberIds(teamId: string): Promise<string[]> {
  const members = await db.user.findMany({ where: { teamId, deletedAt: null }, select: { id: true } });
  return members.map((m) => m.id);
}

/** Shape shared by Lead and Deal where-inputs for owner/team scoping. */
type OwnedTeamWhere = {
  OR?: { ownerId?: string | { in: string[] } | null; teamId?: string | null }[];
};

/** Scope for entities that carry ownerId + teamId (Lead, Deal). */
export async function ownedTeamScope(user: SessionUser): Promise<OwnedTeamWhere> {
  if (seesAll(user.role)) return {};
  if (user.role === "TEAM_LEAD" && user.teamId) {
    const ids = await teamMemberIds(user.teamId);
    return { OR: [{ teamId: user.teamId }, { ownerId: { in: ids } }] };
  }
  // REP: own records plus unassigned records shared with their team
  const or: OwnedTeamWhere["OR"] = [{ ownerId: user.id }];
  if (user.teamId) or.push({ teamId: user.teamId, ownerId: null });
  return { OR: or };
}

/** Scope for Account/Contact (ownerId only, no teamId column). */
export async function ownedScope(
  user: SessionUser
): Promise<Prisma.AccountWhereInput & Prisma.ContactWhereInput> {
  if (seesAll(user.role)) return {};
  if (user.role === "TEAM_LEAD" && user.teamId) {
    const ids = await teamMemberIds(user.teamId);
    return { OR: [{ ownerId: { in: ids } }, { ownerId: null }] };
  }
  if (user.teamId) {
    const ids = await teamMemberIds(user.teamId);
    return { OR: [{ ownerId: user.id }, { ownerId: null }, { ownerId: { in: ids } }] };
  }
  return { OR: [{ ownerId: user.id }, { ownerId: null }] };
}

export const leadScope = ownedTeamScope;
export const dealScope = ownedTeamScope;
export const accountScope = ownedScope;
export const contactScope = ownedScope;

/** True if the user may see this specific owner's record (detail-page check). */
export async function canAccessOwned(
  user: SessionUser,
  record: { ownerId: string | null; teamId?: string | null }
): Promise<boolean> {
  if (seesAll(user.role)) return true;
  if (record.ownerId === user.id) return true;
  if (user.role === "TEAM_LEAD" && user.teamId) {
    if (record.teamId === user.teamId) return true;
    if (record.ownerId) {
      const owner = await db.user.findUnique({ where: { id: record.ownerId }, select: { teamId: true } });
      if (owner?.teamId === user.teamId) return true;
    }
    return false;
  }
  // REP
  if (!record.ownerId) {
    if (record.teamId === undefined) return true; // account/contact without owner: shared
    return record.teamId === user.teamId || record.teamId == null;
  }
  if (user.teamId && record.teamId === undefined) {
    const owner = await db.user.findUnique({ where: { id: record.ownerId }, select: { teamId: true } });
    if (owner?.teamId === user.teamId) return true;
  }
  return false;
}

export async function assertCanAccessOwned(
  user: SessionUser,
  record: { ownerId: string | null; teamId?: string | null } | null
): Promise<void> {
  if (!record) throw new AuthError("Not found");
  if (!(await canAccessOwned(user, record))) throw new AuthError("Forbidden");
}

// ─── Documents ───────────────────────────────────────────────────────────────
// Documents inherit the linked record's permissions. KYC documents are
// additionally restricted to record owner + managers + admin + compliance
// (READ_ONLY) + the owner's team lead.

export async function canViewDocument(
  user: SessionUser,
  doc: { category: string; ownerId: string | null; teamId?: string | null }
): Promise<boolean> {
  if (!(await canAccessOwned(user, doc))) return false;
  if (doc.category !== "KYC") return true;
  if (user.role === "ADMIN" || user.role === "MANAGER" || user.role === "READ_ONLY") return true;
  if (doc.ownerId === user.id) return true;
  if (user.role === "TEAM_LEAD" && doc.ownerId) {
    const owner = await db.user.findUnique({ where: { id: doc.ownerId }, select: { teamId: true } });
    return owner?.teamId === user.teamId;
  }
  return false;
}
