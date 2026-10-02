import { computeEventHash, hashCustomerRef, type PrismaClient, verifyBankChain } from "@amil/db";
import { notFound } from "../errors";

export interface AuditQuery {
  customerRef?: string | undefined;
  rulePackKey?: string | undefined;
  from?: string | undefined;
  to?: string | undefined;
  limit?: number | undefined;
  before?: string | undefined;
}

type EventRow = Awaited<ReturnType<PrismaClient["insightEvent"]["findMany"]>>[number];

const shownField = (shown: unknown, key: string): string | null => {
  const v = (shown as Record<string, unknown> | null)?.[key];
  return typeof v === "string" ? v : null;
};

export const eventSummary = (e: EventRow) => ({
  id: e.id,
  seq: e.seq.toString(),
  occurredAt: e.occurredAt.toISOString(),
  trigger: e.trigger,
  rulePackKey: e.rulePackKey,
  rulePackVersion: e.rulePackVersion,
  variant: e.variant,
  locale: e.locale,
  applicable: e.applicable,
  severity: e.severity,
  templateKey: e.templateKey,
  validatorResult: e.validatorResult,
  modelProvider: e.modelProvider,
  latencyMs: e.latencyMs,
  // Insight cards and compare views carry a headline, Ask AMIL turns an answer, and charge
  // explanations a name.
  headline:
    shownField(e.shown, "headline") ??
    shownField((e.shown as { answer?: unknown } | null)?.answer, "headline") ??
    shownField(e.shown, "name"),
  suppressed: shownField(e.shown, "suppressed"),
});

function where(bankId: string, secret: string, q: AuditQuery) {
  return {
    bankId,
    ...(q.customerRef ? { customerRefHash: hashCustomerRef(secret, bankId, q.customerRef) } : {}),
    ...(q.rulePackKey ? { rulePackKey: q.rulePackKey } : {}),
    ...(q.from || q.to
      ? {
          occurredAt: {
            ...(q.from ? { gte: new Date(q.from) } : {}),
            ...(q.to ? { lte: new Date(q.to) } : {}),
          },
        }
      : {}),
    ...(q.before ? { seq: { lt: BigInt(q.before) } } : {}),
  };
}

/** Audit search (section 11). Customer refs are matched by their keyed hash: the log never holds them. */
export async function searchAudit(
  prisma: PrismaClient,
  bankId: string,
  secret: string,
  q: AuditQuery,
) {
  const limit = Math.min(q.limit ?? 50, 500);
  const rows = await prisma.insightEvent.findMany({
    where: where(bankId, secret, q),
    orderBy: { seq: "desc" },
    take: limit + 1,
  });
  const page = rows.slice(0, limit);
  return {
    events: page.map(eventSummary),
    nextBefore: rows.length > limit ? (page.at(-1)?.seq.toString() ?? null) : null,
  };
}

/** One event in full, with its responses and a check that its own hash and its link verify. */
export async function auditEvent(prisma: PrismaClient, bankId: string, id: string) {
  const e = await prisma.insightEvent.findFirst({ where: { id, bankId } });
  if (!e) throw notFound();
  const responses = await prisma.customerResponse.findMany({
    where: { insightEventId: e.id },
    orderBy: { at: "asc" },
  });
  const prev = await prisma.insightEvent.findFirst({
    where: { bankId, seq: { lt: e.seq } },
    orderBy: { seq: "desc" },
    select: { hash: true },
  });
  const { seq: _seq, prevHash, hash: _hash, ...content } = e;
  const recomputed = computeEventHash(prevHash, content);
  return {
    event: {
      ...eventSummary(e),
      customerRefHash: e.customerRefHash,
      inputSnapshotHash: e.inputSnapshotHash,
      templateVersion: e.templateVersion,
      modelVersion: e.modelVersion,
      facts: e.facts,
      shown: e.shown,
      retentionUntil: e.retentionUntil.toISOString(),
      prevHash: e.prevHash,
      hash: e.hash,
    },
    responses: responses.map((r) => ({
      id: r.id,
      action: r.action,
      optionKey: r.optionKey,
      at: r.at.toISOString(),
    })),
    chain: {
      hashValid: recomputed === e.hash,
      linkValid: prev ? prev.hash === e.prevHash : true,
    },
  };
}

export const verifyChain = (prisma: PrismaClient, bankId: string) =>
  verifyBankChain(prisma, bankId).then((r) => ({
    ...r,
    firstBrokenSeq: r.firstBrokenSeq?.toString() ?? null,
  }));

const CSV_COLUMNS = [
  "seq",
  "occurredAt",
  "trigger",
  "rulePackKey",
  "rulePackVersion",
  "variant",
  "locale",
  "applicable",
  "severity",
  "templateKey",
  "validatorResult",
  "modelProvider",
  "latencyMs",
  "headline",
  "suppressed",
  "hash",
] as const;

const csvCell = (v: unknown) => {
  const s =
    typeof v === "string"
      ? v
      : typeof v === "number" || typeof v === "boolean"
        ? String(v)
        : v === null || v === undefined
          ? ""
          : JSON.stringify(v);
  // Quote everything; neutralise spreadsheet formulas (CSV injection).
  const safe = /^[=+\-@]/.test(s) ? `'${s}` : s;
  return `"${safe.replace(/"/g, '""')}"`;
};

/** Export (CSV or JSON) for the same filters, up to 10,000 events. */
export async function exportAudit(
  prisma: PrismaClient,
  bankId: string,
  secret: string,
  q: AuditQuery,
  format: "csv" | "json",
) {
  const rows = await prisma.insightEvent.findMany({
    where: where(bankId, secret, q),
    orderBy: { seq: "asc" },
    take: 10_000,
  });
  if (format === "json")
    return JSON.stringify(
      rows.map((e) => ({
        ...eventSummary(e),
        facts: e.facts,
        shown: e.shown,
        prevHash: e.prevHash,
        hash: e.hash,
      })),
      null,
      2,
    );
  const lines = rows.map((e) => {
    const s = { ...eventSummary(e), hash: e.hash } as Record<string, unknown>;
    return CSV_COLUMNS.map((c) => csvCell(s[c])).join(",");
  });
  return [CSV_COLUMNS.join(","), ...lines].join("\n");
}

/**
 * Complaints lookup (section 11, headline feature): exactly which insights a customer saw in a
 * period, what each said, and how they responded, from the hash-chained audit log.
 */
export async function complaints(
  prisma: PrismaClient,
  bankId: string,
  secret: string,
  q: { customerRef: string; from?: string | undefined; to?: string | undefined },
) {
  const rows = await prisma.insightEvent.findMany({
    where: { ...where(bankId, secret, q), applicable: true, templateKey: { not: null } },
    orderBy: { seq: "asc" },
    include: { responses: { orderBy: { at: "asc" } } },
  });
  const chain = await verifyChain(prisma, bankId);
  return {
    customerRef: q.customerRef,
    chainVerified: chain.ok,
    insights: rows.map((e) => {
      const shown = (e.shown ?? {}) as Record<string, unknown>;
      const answer = shown.answer as Record<string, unknown> | undefined;
      const card = answer ?? shown;
      return {
        ...eventSummary(e),
        question: typeof shown.question === "string" ? shown.question : null,
        body:
          typeof card.body === "string"
            ? card.body
            : typeof card.description === "string"
              ? card.description
              : null,
        facts: Array.isArray(card.facts) ? card.facts : [],
        options: Array.isArray(card.options) ? card.options : [],
        aiDisclosure: typeof card.aiDisclosure === "string" ? card.aiDisclosure : null,
        responses: e.responses.map((r) => ({
          action: r.action,
          optionKey: r.optionKey,
          at: r.at.toISOString(),
        })),
      };
    }),
  };
}
