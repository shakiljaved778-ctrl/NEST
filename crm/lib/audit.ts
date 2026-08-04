import type { AuditAction, EntityType, Prisma } from "@prisma/client";
import { db } from "@/lib/db";

// The audit trail is append-only: this module exposes create + query only.
// There is intentionally no update or delete API for AuditLog anywhere in the
// codebase.

export interface AuditEntry {
  action: AuditAction;
  entityType: EntityType;
  entityId?: string | null;
  entityLabel?: string | null;
  actorId?: string | null;
  actorEmail?: string | null;
  before?: unknown;
  after?: unknown;
  ip?: string | null;
}

const SENSITIVE_KEYS = new Set(["passwordHash", "totpSecret", "nationalIdEnc"]);

function sanitize(obj: unknown): Prisma.InputJsonValue | undefined {
  if (obj == null) return undefined;
  try {
    const clone = JSON.parse(
      JSON.stringify(obj, (key, value) => (SENSITIVE_KEYS.has(key) ? "[redacted]" : value))
    );
    return clone;
  } catch {
    return undefined;
  }
}

export async function logAudit(entry: AuditEntry): Promise<void> {
  try {
    await db.auditLog.create({
      data: {
        action: entry.action,
        entityType: entry.entityType,
        entityId: entry.entityId ?? null,
        entityLabel: entry.entityLabel ?? null,
        actorId: entry.actorId ?? null,
        actorEmail: entry.actorEmail ?? null,
        before: sanitize(entry.before),
        after: sanitize(entry.after),
        ip: entry.ip ?? null,
      },
    });
  } catch (err) {
    // Auditing must never take down the main operation, but we do surface it.
    console.error("[audit] failed to write audit log", err);
  }
}

/** Compute a before/after diff limited to changed keys (for UPDATE logs). */
export function diffForAudit(
  before: Record<string, unknown>,
  after: Record<string, unknown>
): { before: Record<string, unknown>; after: Record<string, unknown> } {
  const b: Record<string, unknown> = {};
  const a: Record<string, unknown> = {};
  for (const key of new Set([...Object.keys(before), ...Object.keys(after)])) {
    if (SENSITIVE_KEYS.has(key)) continue;
    const bv = before[key];
    const av = after[key];
    if (JSON.stringify(bv) !== JSON.stringify(av)) {
      b[key] = bv instanceof Date ? bv.toISOString() : bv;
      a[key] = av instanceof Date ? av.toISOString() : av;
    }
  }
  return { before: b, after: a };
}
