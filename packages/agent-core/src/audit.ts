import type { AuditActorType } from "@voyara/contracts";

export interface AuditRecord {
  actorType: AuditActorType;
  action: string;
  toolName: string;
  inputHash: string;
  outputHash?: string;
  tripId?: string;
  createdAt: string;
}

/** Append-only audit sink. In prod this maps to an INSERT-only Postgres table. */
export interface AuditSink {
  append(record: AuditRecord): Promise<void>;
}

export class InMemoryAuditSink implements AuditSink {
  private readonly rows: AuditRecord[] = [];
  async append(record: AuditRecord): Promise<void> {
    Object.freeze(record);
    this.rows.push(record);
  }
  all(): readonly AuditRecord[] {
    return this.rows;
  }
}

/** Stable, dependency-free hash for audit fingerprints (FNV-1a, hex). */
export function hashJson(value: unknown): string {
  const s = JSON.stringify(value ?? null);
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(16).padStart(8, "0");
}
