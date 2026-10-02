import type { Prisma, PrismaClient } from "@amil/db";
import { getPack, isPackKey } from "@amil/rule-packs";
import type { Variant } from "@amil/rules-engine";
import { HttpError, notFound } from "../errors";
import type { ConsoleUser } from "./guard";

/** A validation failure the console shows next to the field (staff-facing, so it has detail). */
export class ConsoleValidationError extends HttpError {
  constructor(
    code: string,
    readonly issues: { path: string; message: string }[],
  ) {
    super(400, code);
  }
}

type Row = Awaited<ReturnType<PrismaClient["rulePack"]["findMany"]>>[number];

/** The version the engine uses now: latest active version already effective (same rule as checks). */
function currentOf(rows: Row[], now: Date): Row | undefined {
  return rows
    .filter((r) => r.status === "active" && r.effectiveFrom <= now)
    .sort(
      (a, b) =>
        b.effectiveFrom.getTime() - a.effectiveFrom.getTime() ||
        b.createdAt.getTime() - a.createdAt.getTime(),
    )[0];
}

const view = (r: Row) => ({
  id: r.id,
  version: r.version,
  status: r.status,
  enabled: r.enabled,
  effectiveFrom: r.effectiveFrom.toISOString(),
  createdAt: r.createdAt.toISOString(),
  createdBy: r.createdBy,
  parameters: r.parameters,
});

export async function listPacks(prisma: PrismaClient, bankId: string, now: Date) {
  const rows = await prisma.rulePack.findMany({
    where: { bankId },
    orderBy: [{ key: "asc" }, { variant: "asc" }, { createdAt: "asc" }],
  });
  const groups = new Map<string, Row[]>();
  for (const r of rows)
    groups.set(`${r.key}|${r.variant}`, [...(groups.get(`${r.key}|${r.variant}`) ?? []), r]);
  return [...groups.entries()].flatMap(([id, list]) => {
    const [key, variant] = id.split("|") as [string, Variant];
    if (!isPackKey(key)) return [];
    const def = getPack(key, variant).definition;
    const current = currentOf(list, now);
    return [
      {
        key,
        variant,
        productFamily: def.productFamily,
        triggers: def.triggers,
        requiredData: def.requiredData,
        facts: def.facts,
        defaults: def.parameters,
        current: current ? view(current) : null,
        scheduled: list.filter((r) => r.status === "active" && r.effectiveFrom > now).map(view),
        versions: list.map(view).reverse(),
      },
    ];
  });
}

/** Bump the patch number: a parameter change on the same calculator (1.1.0 -> 1.1.1). */
export function nextVersion(versions: string[]): string {
  const latest = versions
    .map((v) => v.split(".").map(Number) as [number, number, number])
    .sort((a, b) => a[0] - b[0] || a[1] - b[1] || a[2] - b[2])
    .at(-1) ?? [1, 0, 0];
  return `${latest[0]}.${latest[1]}.${latest[2] + 1}`;
}

/** Changed keys only: what the approval log and the console's diff view show. */
export function parameterDiff(before: Record<string, unknown>, after: Record<string, unknown>) {
  const keys = [...new Set([...Object.keys(before), ...Object.keys(after)])].sort();
  const changed = keys.filter((k) => JSON.stringify(before[k]) !== JSON.stringify(after[k]));
  return {
    before: Object.fromEntries(changed.map((k) => [k, before[k] ?? null])),
    after: Object.fromEntries(changed.map((k) => [k, after[k] ?? null])),
  };
}

/**
 * A new parameter version (section 11: validation, diff, version history, effective date). The
 * stored parameters are validated against the pack's own schema before anything is written, so
 * an invalid value can never reach the engine. The previous version stays until the new one's
 * effective date.
 */
export async function createPackVersion(
  prisma: PrismaClient,
  user: ConsoleUser,
  key: string,
  variant: Variant,
  body: {
    parameters: Record<string, unknown>;
    effectiveFrom?: string | undefined;
    comment?: string | undefined;
  },
  now: Date,
) {
  if (!isPackKey(key)) throw notFound();
  const rows = await prisma.rulePack.findMany({ where: { bankId: user.bankId, key, variant } });
  const current = currentOf(rows, now);
  if (!current) throw notFound();
  const pack = getPack(key, variant);
  const before = {
    ...(pack.defaultParameters as object),
    ...(current.parameters as object),
  } as Record<string, unknown>;
  const merged = { ...before, ...body.parameters };
  const parsed = pack.parametersSchema.safeParse(merged);
  if (!parsed.success)
    throw new ConsoleValidationError(
      "invalid_parameters",
      parsed.error.issues.map((i) => ({ path: i.path.join("."), message: i.message })),
    );
  const diff = parameterDiff(before, parsed.data as Record<string, unknown>);
  if (!Object.keys(diff.after).length) throw new ConsoleValidationError("no_change", []);
  const effectiveFrom = body.effectiveFrom ? new Date(body.effectiveFrom) : now;
  if (Number.isNaN(effectiveFrom.getTime()) || effectiveFrom < new Date(now.getTime() - 60_000))
    throw new ConsoleValidationError("invalid_effective_date", [
      { path: "effectiveFrom", message: "must be now or later" },
    ]);
  const version = nextVersion(rows.map((r) => r.version));
  return prisma.$transaction(async (tx) => {
    const row = await tx.rulePack.create({
      data: {
        bankId: user.bankId,
        key,
        variant,
        version,
        productFamily: current.productFamily,
        status: "active",
        enabled: current.enabled,
        parameters: parsed.data as Prisma.InputJsonValue,
        effectiveFrom,
        createdBy: user.id,
      },
    });
    await tx.approvalLog.create({
      data: {
        bankId: user.bankId,
        entityType: "rule_pack",
        entityId: row.id,
        action: "parameters_changed",
        fromStatus: current.version,
        toStatus: version,
        actorId: user.id,
        comment: body.comment ?? null,
        diff: diff,
        at: now,
      },
    });
    return { ...view(row), key, variant, diff };
  });
}

/**
 * Kill switch for a pack variant (non-negotiable 9). It applies to every version, including
 * scheduled ones, so a disabled pack cannot come back on when a new version takes effect.
 */
export async function setPackEnabled(
  prisma: PrismaClient,
  user: ConsoleUser,
  key: string,
  variant: Variant,
  enabled: boolean,
  comment: string | undefined,
  now: Date,
) {
  const rows = await prisma.rulePack.findMany({ where: { bankId: user.bankId, key, variant } });
  if (!rows.length) throw notFound();
  await prisma.$transaction([
    prisma.rulePack.updateMany({ where: { bankId: user.bankId, key, variant }, data: { enabled } }),
    prisma.approvalLog.create({
      data: {
        bankId: user.bankId,
        entityType: "rule_pack",
        entityId: `${key}:${variant}`,
        action: enabled ? "enabled" : "disabled",
        actorId: user.id,
        comment: comment ?? null,
        at: now,
      },
    }),
  ]);
  return { key, variant, enabled };
}
