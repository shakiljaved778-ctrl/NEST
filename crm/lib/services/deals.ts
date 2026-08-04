import { Prisma, type DealStatus } from "@prisma/client";
import { db } from "@/lib/db";
import { AuthError } from "@/lib/auth";
import { dealScope, assertWrite, assertCanAccessOwned, type SessionUser } from "@/lib/rbac";
import { logAudit, diffForAudit } from "@/lib/audit";
import type { z } from "zod";
import type { dealSchema } from "@/lib/validation";

export interface DealFilters {
  q?: string;
  pipelineId?: string;
  stageId?: string;
  status?: string;
  ownerId?: string;
  teamId?: string;
  page?: number;
  pageSize?: number;
}

export function buildDealWhere(filters: DealFilters): Prisma.DealWhereInput {
  const where: Prisma.DealWhereInput = { deletedAt: null };
  if (filters.pipelineId) where.pipelineId = filters.pipelineId;
  if (filters.stageId) where.stageId = filters.stageId;
  if (filters.status) where.status = filters.status as DealStatus;
  if (filters.ownerId) where.ownerId = filters.ownerId;
  if (filters.teamId) where.teamId = filters.teamId;
  if (filters.q) {
    where.OR = [
      { name: { contains: filters.q, mode: "insensitive" } },
      { account: { legalName: { contains: filters.q, mode: "insensitive" } } },
    ];
  }
  return where;
}

const DEAL_LIST_INCLUDE = {
  stage: { select: { id: true, name: true, probability: true, type: true, sortOrder: true } },
  owner: { select: { id: true, name: true } },
  account: { select: { id: true, legalName: true } },
} satisfies Prisma.DealInclude;

export async function listDeals(user: SessionUser, filters: DealFilters) {
  const page = Math.max(filters.page ?? 1, 1);
  const pageSize = Math.min(Math.max(filters.pageSize ?? 25, 5), 100);
  const scope = await dealScope(user);
  const where: Prisma.DealWhereInput = { AND: [buildDealWhere(filters), scope] };
  const [total, deals] = await Promise.all([
    db.deal.count({ where }),
    db.deal.findMany({
      where,
      orderBy: { updatedAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: DEAL_LIST_INCLUDE,
    }),
  ]);
  return { deals, total, page, pageSize, pages: Math.max(Math.ceil(total / pageSize), 1) };
}

/** All open deals of a pipeline grouped for the kanban board. */
export async function kanbanDeals(user: SessionUser, pipelineId: string, filters: Omit<DealFilters, "pipelineId">) {
  const scope = await dealScope(user);
  return db.deal.findMany({
    where: {
      AND: [buildDealWhere({ ...filters, pipelineId }), scope],
    },
    orderBy: { updatedAt: "desc" },
    take: 500,
    include: DEAL_LIST_INCLUDE,
  });
}

export async function getDeal(user: SessionUser, id: string) {
  const deal = await db.deal.findFirst({
    where: { id, deletedAt: null },
    include: {
      pipeline: { include: { stages: { where: { deletedAt: null }, orderBy: { sortOrder: "asc" } } } },
      stage: true,
      owner: { select: { id: true, name: true } },
      team: { select: { id: true, name: true } },
      account: { select: { id: true, legalName: true } },
      primaryContact: { select: { id: true, firstName: true, lastName: true, email: true, phone: true } },
      contacts: { include: { contact: { select: { id: true, firstName: true, lastName: true, position: true } } } },
      products: { include: { product: true } },
      stageHistory: {
        orderBy: { createdAt: "asc" },
        include: { toStage: { select: { name: true } }, fromStage: { select: { name: true } } },
      },
      activities: {
        where: { deletedAt: null },
        orderBy: { occurredAt: "desc" },
        include: { user: { select: { name: true } } },
      },
      tasks: { where: { deletedAt: null }, orderBy: { dueAt: "asc" }, include: { owner: { select: { name: true } } } },
      documents: { where: { deletedAt: null }, orderBy: { updatedAt: "desc" }, include: { uploadedBy: { select: { name: true } } } },
      subscriptions: { where: { deletedAt: null }, include: { product: { select: { name: true } } } },
    },
  });
  if (!deal) return null;
  await assertCanAccessOwned(user, deal);
  return deal;
}

export async function createDeal(user: SessionUser, input: z.infer<typeof dealSchema>) {
  assertWrite(user);
  const stage = await db.stage.findFirst({ where: { id: input.stageId, pipelineId: input.pipelineId, deletedAt: null } });
  if (!stage) throw new Error("Stage does not belong to the selected pipeline");
  const ownerId = input.ownerId || user.id;
  const owner = await db.user.findUnique({ where: { id: ownerId }, select: { teamId: true } });

  const deal = await db.deal.create({
    data: {
      name: input.name,
      pipelineId: input.pipelineId,
      stageId: input.stageId,
      status: stage.type === "WON" ? "WON" : stage.type === "LOST" ? "LOST" : "OPEN",
      value: input.value,
      currency: input.currency,
      fxRateToQar: input.fxRateToQar,
      expectedCloseAt: input.expectedCloseAt ?? null,
      probability: input.probability ?? null,
      ownerId,
      teamId: owner?.teamId ?? null,
      accountId: input.accountId || null,
      primaryContactId: input.primaryContactId || null,
      customFields: (input.customFields ?? {}) as Prisma.InputJsonValue,
      ...(input.products?.length
        ? { products: { create: input.products.map((p) => ({ productId: p.productId, quantity: p.quantity, unitPrice: p.unitPrice })) } }
        : {}),
    },
  });
  await db.dealStageHistory.create({
    data: { dealId: deal.id, fromStageId: null, toStageId: input.stageId, changedById: user.id },
  });
  await logAudit({
    action: "CREATE", entityType: "DEAL", entityId: deal.id, entityLabel: deal.name,
    actorId: user.id, actorEmail: user.email, after: { value: deal.value, stageId: deal.stageId },
  });
  return deal;
}

export async function updateDeal(user: SessionUser, id: string, data: Record<string, unknown>) {
  assertWrite(user);
  const before = await db.deal.findFirst({ where: { id, deletedAt: null } });
  if (!before) throw new AuthError("Not found");
  await assertCanAccessOwned(user, before);

  if (data.ownerId && data.ownerId !== before.ownerId) {
    const owner = await db.user.findUnique({ where: { id: data.ownerId as string }, select: { teamId: true } });
    data.teamId = owner?.teamId ?? null;
  }

  const after = await db.deal.update({ where: { id }, data: data as Prisma.DealUpdateInput });
  const { before: b, after: a } = diffForAudit(before as never, after as never);
  await logAudit({
    action: "UPDATE", entityType: "DEAL", entityId: id, entityLabel: after.name,
    actorId: user.id, actorEmail: user.email, before: b, after: a,
  });
  return after;
}

/**
 * Move a deal to another stage (kanban drag or detail action).
 * WON requires no reason; LOST requires lossReason. Records stage history.
 */
export async function moveDealStage(
  user: SessionUser,
  dealId: string,
  toStageId: string,
  opts: { lossReason?: string; winReason?: string } = {}
) {
  assertWrite(user);
  const deal = await db.deal.findFirst({ where: { id: dealId, deletedAt: null }, include: { stage: true } });
  if (!deal) throw new AuthError("Not found");
  await assertCanAccessOwned(user, deal);
  if (deal.stageId === toStageId) return deal;

  const toStage = await db.stage.findFirst({ where: { id: toStageId, pipelineId: deal.pipelineId, deletedAt: null } });
  if (!toStage) throw new Error("Invalid target stage");
  if (toStage.type === "LOST" && !opts.lossReason) throw new Error("A loss reason is required to close a deal as lost");

  const status: DealStatus = toStage.type === "WON" ? "WON" : toStage.type === "LOST" ? "LOST" : "OPEN";

  const updated = await db.$transaction(async (tx) => {
    const u = await tx.deal.update({
      where: { id: dealId },
      data: {
        stageId: toStageId,
        status,
        wonAt: status === "WON" ? new Date() : null,
        lostAt: status === "LOST" ? new Date() : null,
        lossReason: status === "LOST" ? (opts.lossReason ?? deal.lossReason) : null,
        winReason: status === "WON" ? (opts.winReason ?? deal.winReason) : deal.winReason,
      },
    });
    await tx.dealStageHistory.create({
      data: { dealId, fromStageId: deal.stageId, toStageId, changedById: user.id },
    });
    return u;
  });

  await logAudit({
    action: "STAGE_CHANGE", entityType: "DEAL", entityId: dealId, entityLabel: deal.name,
    actorId: user.id, actorEmail: user.email,
    before: { stage: deal.stage.name }, after: { stage: toStage.name, status, lossReason: opts.lossReason },
  });

  return updated;
}

/** Closed-won follow-up: create subscription records from the deal's line items. */
export async function createSubscriptionsForDeal(
  user: SessionUser,
  dealId: string,
  items: { productId: string; startDate: Date; renewalDate: Date | null; mrrValue: number }[]
) {
  assertWrite(user);
  const deal = await db.deal.findFirst({ where: { id: dealId, deletedAt: null } });
  if (!deal) throw new AuthError("Not found");
  await assertCanAccessOwned(user, deal);
  if (!deal.accountId && !deal.primaryContactId) throw new Error("Deal has no linked client");

  const created = await db.$transaction(
    items.map((item) =>
      db.subscription.create({
        data: {
          accountId: deal.accountId,
          contactId: deal.accountId ? null : deal.primaryContactId,
          productId: item.productId,
          dealId,
          startDate: item.startDate,
          renewalDate: item.renewalDate,
          status: "ACTIVE",
          mrrValue: item.mrrValue,
        },
      })
    )
  );
  // client becomes active on first subscription
  if (deal.accountId) {
    await db.account.update({ where: { id: deal.accountId }, data: { status: "ACTIVE" } });
  } else if (deal.primaryContactId) {
    await db.contact.update({ where: { id: deal.primaryContactId }, data: { clientStatus: "ACTIVE" } });
  }
  for (const sub of created) {
    await logAudit({
      action: "CREATE", entityType: "SUBSCRIPTION", entityId: sub.id,
      actorId: user.id, actorEmail: user.email,
      after: { dealId, productId: sub.productId, mrrValue: sub.mrrValue },
    });
  }
  return created;
}

/** Weighted pipeline forecast grouped by month × owner (open deals only). */
export async function forecast(user: SessionUser, filters: { teamId?: string; ownerId?: string } = {}) {
  const scope = await dealScope(user);
  const deals = await db.deal.findMany({
    where: {
      AND: [
        { deletedAt: null, status: "OPEN" },
        filters.teamId ? { teamId: filters.teamId } : {},
        filters.ownerId ? { ownerId: filters.ownerId } : {},
        scope,
      ],
    },
    include: {
      stage: { select: { name: true, probability: true } },
      owner: { select: { id: true, name: true } },
      team: { select: { id: true, name: true } },
    },
  });

  return deals.map((d) => {
    const prob = (d.probability ?? d.stage.probability) / 100;
    const valueQar = d.value * d.fxRateToQar;
    const month = d.expectedCloseAt
      ? `${d.expectedCloseAt.getUTCFullYear()}-${String(d.expectedCloseAt.getUTCMonth() + 1).padStart(2, "0")}`
      : "unscheduled";
    return {
      id: d.id,
      name: d.name,
      month,
      owner: d.owner?.name ?? "Unassigned",
      ownerId: d.ownerId,
      team: d.team?.name ?? "—",
      stage: d.stage.name,
      valueQar,
      weightedQar: valueQar * prob,
      probability: prob * 100,
    };
  });
}
