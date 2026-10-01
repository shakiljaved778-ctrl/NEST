/**
 * Tamper-evident audit trail (non-negotiable 7).
 *
 * Each InsightEvent stores prevHash and hash, where
 *   hash = SHA-256( prevHash + "\n" + canonicalJson(event without seq/hash) )
 * and events chain per bank in `seq` order. The database rejects UPDATE/DELETE/TRUNCATE
 * (migration 20260930194700). The chain makes any out-of-band edit, deletion or re-ordering
 * detectable by `verifyChain`.
 */
import { createHash, createHmac } from "node:crypto";
import type { Prisma, PrismaClient } from "@prisma/client";

export const GENESIS_HASH = "0".repeat(64);

/** JSON with object keys sorted recursively, so logically equal values hash equally. */
export function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (value instanceof Date) return JSON.stringify(value.toISOString());
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonicalJson(v)}`).join(",")}}`;
}

export const sha256 = (s: string): string => createHash("sha256").update(s).digest("hex");

/** HMAC of the bank's customer reference. The raw ref is never stored in the audit trail. */
export function hashCustomerRef(secret: string, bankId: string, customerRef: string): string {
  return createHmac("sha256", secret).update(`${bankId}:${customerRef}`).digest("hex");
}

/** The fields an audit event commits to. Everything except the DB sequence and its own hash. */
export interface AuditEventContent {
  id: string;
  bankId: string;
  occurredAt: Date;
  trigger: string;
  customerRefHash: string;
  rulePackKey: string;
  rulePackVersion: string;
  variant: "conventional" | "islamic";
  inputSnapshotHash: string;
  applicable: boolean;
  severity: "info" | "caution" | "critical" | null;
  facts: unknown;
  templateKey: string | null;
  templateVersion: number | null;
  modelProvider: string | null;
  modelVersion: string | null;
  validatorResult: "passed" | "rejected" | "not_used";
  locale: "en" | "ar";
  shown: unknown;
  latencyMs: number | null;
  retentionUntil: Date;
}

export function computeEventHash(prevHash: string, content: AuditEventContent): string {
  return sha256(`${prevHash}\n${canonicalJson({ ...content, prevHash })}`);
}

type Tx = Prisma.TransactionClient;

/**
 * Append an event to the bank's chain. A transaction-scoped advisory lock serialises appends per
 * bank, so two concurrent writers can never fork the chain.
 */
export async function appendInsightEvent(
  prisma: PrismaClient,
  content: AuditEventContent,
): Promise<{ id: string; hash: string; prevHash: string }> {
  return prisma.$transaction(async (tx: Tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`amil_audit_chain:${content.bankId}`}))`;
    const last = await tx.insightEvent.findFirst({
      where: { bankId: content.bankId },
      orderBy: { seq: "desc" },
      select: { hash: true },
    });
    const prevHash = last?.hash ?? GENESIS_HASH;
    const hash = computeEventHash(prevHash, content);
    await tx.insightEvent.create({
      data: {
        ...content,
        facts: content.facts as Prisma.InputJsonValue,
        shown: content.shown as Prisma.InputJsonValue,
        prevHash,
        hash,
      },
    });
    return { id: content.id, hash, prevHash };
  });
}

export interface StoredEvent extends AuditEventContent {
  seq: bigint;
  prevHash: string;
  hash: string;
}

export interface ChainVerification {
  ok: boolean;
  checked: number;
  /** seq of the first event whose hash or link does not verify. */
  firstBrokenSeq: bigint | null;
  reason: "hash_mismatch" | "broken_link" | null;
}

/**
 * Verify a bank's events in seq order. The first event's prevHash is taken as the anchor: the
 * genesis hash, or the hash of the last event removed by the retention purge (D-005).
 */
export function verifyChain(events: StoredEvent[]): ChainVerification {
  let expectedPrev: string | null = null;
  for (const e of events) {
    const { seq, prevHash, hash, ...content } = e;
    if (expectedPrev !== null && prevHash !== expectedPrev) {
      return { ok: false, checked: events.indexOf(e), firstBrokenSeq: seq, reason: "broken_link" };
    }
    if (computeEventHash(prevHash, content) !== hash) {
      return {
        ok: false,
        checked: events.indexOf(e),
        firstBrokenSeq: seq,
        reason: "hash_mismatch",
      };
    }
    expectedPrev = hash;
  }
  return { ok: true, checked: events.length, firstBrokenSeq: null, reason: null };
}

/** Load and verify a bank's whole chain. */
export async function verifyBankChain(
  prisma: PrismaClient | Tx,
  bankId: string,
): Promise<ChainVerification> {
  const rows = await prisma.insightEvent.findMany({ where: { bankId }, orderBy: { seq: "asc" } });
  return verifyChain(rows);
}
