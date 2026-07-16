import { Prisma, type LeadStatus } from "@prisma/client";
import { db } from "@/lib/db";
import { AuthError } from "@/lib/auth";
import { leadScope, assertWrite, assertCanAccessOwned, isManagerial, type SessionUser } from "@/lib/rbac";
import { logAudit, diffForAudit } from "@/lib/audit";
import { normalizeEmail, normalizePhone } from "@/lib/utils";
import type { LeadCreateInput, ConvertLeadInput } from "@/lib/validation";
import { routeLead } from "@/lib/services/routing";

export interface LeadFilters {
  q?: string;
  status?: string;
  source?: string;
  ownerId?: string;
  territory?: string;
  campaign?: string;
  minScore?: number;
  dateFrom?: string;
  dateTo?: string;
  sort?: string; // "createdAt" | "score" | "status" | "name" | "slaDueAt"
  dir?: "asc" | "desc";
  page?: number;
  pageSize?: number;
}

export function buildLeadWhere(filters: LeadFilters): Prisma.LeadWhereInput {
  const where: Prisma.LeadWhereInput = { deletedAt: null };
  if (filters.status) where.status = filters.status as LeadStatus;
  if (filters.source) where.source = filters.source;
  if (filters.ownerId) where.ownerId = filters.ownerId;
  if (filters.territory) where.territory = filters.territory;
  if (filters.campaign) where.campaign = filters.campaign;
  if (filters.minScore) where.score = { gte: filters.minScore };
  if (filters.dateFrom || filters.dateTo) {
    where.createdAt = {
      ...(filters.dateFrom ? { gte: new Date(filters.dateFrom) } : {}),
      ...(filters.dateTo ? { lte: new Date(filters.dateTo + "T23:59:59Z") } : {}),
    };
  }
  if (filters.q) {
    const q = filters.q.trim();
    where.OR = [
      { firstName: { contains: q, mode: "insensitive" } },
      { lastName: { contains: q, mode: "insensitive" } },
      { company: { contains: q, mode: "insensitive" } },
      { email: { contains: q, mode: "insensitive" } },
      { phone: { contains: q, mode: "insensitive" } },
    ];
  }
  return where;
}

const SORTS: Record<string, Prisma.LeadOrderByWithRelationInput> = {
  createdAt: { createdAt: "desc" },
  score: { score: "desc" },
  status: { status: "asc" },
  name: { firstName: "asc" },
  slaDueAt: { slaDueAt: "asc" },
};

export async function listLeads(user: SessionUser, filters: LeadFilters) {
  const page = Math.max(filters.page ?? 1, 1);
  const pageSize = Math.min(Math.max(filters.pageSize ?? 25, 5), 100);
  const scope = await leadScope(user);
  const where: Prisma.LeadWhereInput = { AND: [buildLeadWhere(filters), scope] };

  let orderBy = SORTS[filters.sort ?? "createdAt"] ?? SORTS.createdAt;
  if (filters.dir) {
    const key = Object.keys(orderBy)[0] as keyof Prisma.LeadOrderByWithRelationInput;
    orderBy = { [key]: filters.dir } as Prisma.LeadOrderByWithRelationInput;
  }

  const [total, leads] = await Promise.all([
    db.lead.count({ where }),
    db.lead.findMany({
      where,
      orderBy,
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        owner: { select: { id: true, name: true } },
        productInterest: { select: { id: true, name: true } },
      },
    }),
  ]);

  return { leads, total, page, pageSize, pages: Math.max(Math.ceil(total / pageSize), 1) };
}

export async function getLead(user: SessionUser, id: string) {
  const lead = await db.lead.findFirst({
    where: { id, deletedAt: null },
    include: {
      owner: { select: { id: true, name: true } },
      team: { select: { id: true, name: true } },
      productInterest: { select: { id: true, name: true } },
      convertedAccount: { select: { id: true, legalName: true } },
      convertedContact: { select: { id: true, firstName: true, lastName: true } },
      activities: {
        where: { deletedAt: null },
        orderBy: { occurredAt: "desc" },
        include: { user: { select: { name: true } } },
      },
      tasks: {
        where: { deletedAt: null },
        orderBy: { dueAt: "asc" },
        include: { owner: { select: { name: true } } },
      },
      documents: {
        where: { deletedAt: null },
        orderBy: { updatedAt: "desc" },
        include: { uploadedBy: { select: { name: true } } },
      },
    },
  });
  if (!lead) return null;
  await assertCanAccessOwned(user, lead);
  return lead;
}

/** Find potential duplicates by normalized email/phone. */
export async function findDuplicateLeads(email?: string | null, phone?: string | null, excludeId?: string) {
  const or: Prisma.LeadWhereInput[] = [];
  const e = normalizeEmail(email);
  const p = normalizePhone(phone);
  if (e) or.push({ email: e });
  if (p) or.push({ phone: { contains: p.slice(-8) } });
  if (or.length === 0) return [];
  return db.lead.findMany({
    where: { OR: or, deletedAt: null, ...(excludeId ? { id: { not: excludeId } } : {}) },
    select: { id: true, firstName: true, lastName: true, email: true, phone: true, status: true, company: true },
    take: 5,
  });
}

export async function createLead(
  user: SessionUser,
  input: LeadCreateInput,
  opts: { autoRoute?: boolean } = {}
) {
  assertWrite(user);
  const lead = await db.lead.create({
    data: {
      firstName: input.firstName,
      lastName: input.lastName,
      company: input.company ?? null,
      email: normalizeEmail(input.email),
      phone: input.phone ?? null,
      source: input.source ?? "manual",
      channel: input.channel ?? null,
      campaign: input.campaign ?? null,
      territory: input.territory ?? user.territory ?? null,
      productInterestId: input.productInterestId || null,
      score: input.score ?? 0,
      ownerId: input.ownerId ?? (opts.autoRoute ? null : user.id),
      teamId: input.ownerId
        ? (await db.user.findUnique({ where: { id: input.ownerId }, select: { teamId: true } }))?.teamId
        : user.teamId,
      notes: input.notes ?? null,
      lawfulBasis: input.lawfulBasis ?? (input.consent ? "CONSENT" : null),
      consentAt: input.consent || input.lawfulBasis ? new Date() : null,
      customFields: (input.customFields ?? {}) as Prisma.InputJsonValue,
    },
  });

  await logAudit({
    action: "CREATE",
    entityType: "LEAD",
    entityId: lead.id,
    entityLabel: `${lead.firstName} ${lead.lastName}`,
    actorId: user.id,
    actorEmail: user.email,
    after: { status: lead.status, source: lead.source, ownerId: lead.ownerId },
  });

  if (opts.autoRoute) await routeLead(lead.id);
  return lead;
}

export async function updateLead(user: SessionUser, id: string, data: Partial<Record<string, unknown>>) {
  assertWrite(user);
  const before = await db.lead.findFirst({ where: { id, deletedAt: null } });
  if (!before) throw new AuthError("Not found");
  await assertCanAccessOwned(user, before);

  // Reassignment: only managers/team leads can move ownership off themselves
  if (data.ownerId !== undefined && data.ownerId !== before.ownerId) {
    if (!isManagerial(user.role) && user.role !== "TEAM_LEAD") {
      throw new AuthError("Only managers can reassign leads");
    }
    if (data.ownerId) {
      const owner = await db.user.findUnique({ where: { id: data.ownerId as string }, select: { teamId: true } });
      data.teamId = owner?.teamId ?? null;
    }
  }

  // Status transitions
  if (data.status && data.status !== before.status) {
    if (data.status === "DISQUALIFIED" && !data.disqualifyReason && !before.disqualifyReason) {
      throw new Error("Disqualification reason is required");
    }
    // first touch: moving off NEW stamps firstTouchAt
    if (before.status === "NEW" && !before.firstTouchAt) {
      data.firstTouchAt = new Date();
    }
  }

  if (data.email) data.email = normalizeEmail(data.email as string);

  const after = await db.lead.update({ where: { id }, data: data as Prisma.LeadUpdateInput });

  const { before: b, after: a } = diffForAudit(
    before as unknown as Record<string, unknown>,
    after as unknown as Record<string, unknown>
  );
  await logAudit({
    action: "UPDATE",
    entityType: "LEAD",
    entityId: id,
    entityLabel: `${after.firstName} ${after.lastName}`,
    actorId: user.id,
    actorEmail: user.email,
    before: b,
    after: a,
  });
  return after;
}

/** Stamp first touch when a rep logs the first activity on a NEW lead. */
export async function stampFirstTouch(leadId: string): Promise<void> {
  const lead = await db.lead.findUnique({ where: { id: leadId }, select: { firstTouchAt: true, status: true } });
  if (lead && !lead.firstTouchAt) {
    await db.lead.update({
      where: { id: leadId },
      data: { firstTouchAt: new Date(), ...(lead.status === "NEW" ? { status: "CONTACTED" } : {}) },
    });
  }
}

export async function bulkLeadAction(
  user: SessionUser,
  ids: string[],
  action: { type: "assign"; ownerId: string } | { type: "status"; status: LeadStatus; reason?: string } | { type: "delete" }
) {
  assertWrite(user);
  const scope = await leadScope(user);
  const leads = await db.lead.findMany({ where: { id: { in: ids }, deletedAt: null, ...scope }, select: { id: true } });
  const allowedIds = leads.map((l) => l.id);
  if (allowedIds.length === 0) return 0;

  if (action.type === "assign") {
    if (!isManagerial(user.role) && user.role !== "TEAM_LEAD") throw new AuthError("Only managers can reassign");
    const owner = await db.user.findUnique({ where: { id: action.ownerId }, select: { teamId: true } });
    await db.lead.updateMany({
      where: { id: { in: allowedIds } },
      data: { ownerId: action.ownerId, teamId: owner?.teamId ?? null },
    });
    for (const id of allowedIds) {
      await logAudit({
        action: "ASSIGN", entityType: "LEAD", entityId: id, actorId: user.id, actorEmail: user.email,
        after: { ownerId: action.ownerId, bulk: true },
      });
    }
  } else if (action.type === "status") {
    if (action.status === "DISQUALIFIED" && !action.reason) throw new Error("Disqualification reason required");
    await db.lead.updateMany({
      where: { id: { in: allowedIds } },
      data: { status: action.status, ...(action.reason ? { disqualifyReason: action.reason } : {}) },
    });
    for (const id of allowedIds) {
      await logAudit({
        action: "UPDATE", entityType: "LEAD", entityId: id, actorId: user.id, actorEmail: user.email,
        after: { status: action.status, bulk: true },
      });
    }
  } else {
    await db.lead.updateMany({ where: { id: { in: allowedIds } }, data: { deletedAt: new Date() } });
    for (const id of allowedIds) {
      await logAudit({ action: "DELETE", entityType: "LEAD", entityId: id, actorId: user.id, actorEmail: user.email });
    }
  }
  return allowedIds.length;
}

/**
 * Lead → Account + Contact + optional Deal. Carries activities, tasks and
 * documents over to the new contact/account and marks the lead CONVERTED.
 */
export async function convertLead(user: SessionUser, input: ConvertLeadInput) {
  assertWrite(user);
  const lead = await db.lead.findFirst({ where: { id: input.leadId, deletedAt: null } });
  if (!lead) throw new AuthError("Not found");
  await assertCanAccessOwned(user, lead);
  if (lead.status === "CONVERTED") throw new Error("Lead already converted");

  return db.$transaction(async (tx) => {
    // 1. Account
    let accountId: string | null = null;
    if (input.accountMode === "existing" && input.existingAccountId) {
      accountId = input.existingAccountId;
    } else if (input.accountMode === "new") {
      const account = await tx.account.create({
        data: {
          legalName: input.accountName || lead.company || `${lead.firstName} ${lead.lastName}`,
          territory: lead.territory,
          ownerId: lead.ownerId ?? user.id,
          status: "PROSPECT",
        },
      });
      accountId = account.id;
    }

    // 2. Contact
    let contactId: string;
    if (input.contactMode === "existing" && input.existingContactId) {
      contactId = input.existingContactId;
    } else {
      const contact = await tx.contact.create({
        data: {
          firstName: lead.firstName,
          lastName: lead.lastName,
          accountId,
          clientStatus: accountId ? null : "PROSPECT",
          email: lead.email,
          phone: lead.phone,
          ownerId: lead.ownerId ?? user.id,
          lawfulBasis: lead.lawfulBasis,
          consentAt: lead.consentAt,
        },
      });
      contactId = contact.id;
    }

    // 3. Deal
    let dealId: string | null = null;
    if (input.createDeal) {
      const pipeline = await tx.pipeline.findFirst({ where: { isDefault: true, deletedAt: null } });
      const stage = pipeline
        ? await tx.stage.findFirst({ where: { pipelineId: pipeline.id, deletedAt: null }, orderBy: { sortOrder: "asc" } })
        : null;
      if (!pipeline || !stage) throw new Error("No default pipeline configured");
      const owner = lead.ownerId ?? user.id;
      const ownerTeam = (await tx.user.findUnique({ where: { id: owner }, select: { teamId: true } }))?.teamId;
      const deal = await tx.deal.create({
        data: {
          name: input.dealName || `${lead.company ?? `${lead.firstName} ${lead.lastName}`} — New deal`,
          pipelineId: pipeline.id,
          stageId: stage.id,
          value: input.dealValue ?? 0,
          ownerId: owner,
          teamId: ownerTeam ?? null,
          accountId,
          primaryContactId: contactId,
          ...(input.dealProductId
            ? { products: { create: [{ productId: input.dealProductId, quantity: 1, unitPrice: 0 }] } }
            : {}),
        },
      });
      await tx.dealStageHistory.create({
        data: { dealId: deal.id, fromStageId: null, toStageId: stage.id, changedById: user.id },
      });
      dealId = deal.id;
    }

    // 4. Carry history over
    await tx.activity.updateMany({
      where: { leadId: lead.id, deletedAt: null },
      data: { contactId, accountId, dealId },
    });
    await tx.task.updateMany({
      where: { leadId: lead.id, deletedAt: null, status: "OPEN" },
      data: { contactId, accountId },
    });
    await tx.document.updateMany({
      where: { leadId: lead.id, deletedAt: null },
      data: { contactId, accountId },
    });

    // 5. Mark converted
    const updated = await tx.lead.update({
      where: { id: lead.id },
      data: {
        status: "CONVERTED",
        convertedAt: new Date(),
        convertedAccountId: accountId,
        convertedContactId: contactId,
        convertedDealId: dealId,
        firstTouchAt: lead.firstTouchAt ?? new Date(),
      },
    });

    await tx.auditLog.create({
      data: {
        action: "CONVERT",
        entityType: "LEAD",
        entityId: lead.id,
        entityLabel: `${lead.firstName} ${lead.lastName}`,
        actorId: user.id,
        actorEmail: user.email,
        after: { accountId, contactId, dealId },
      },
    });

    return { lead: updated, accountId, contactId, dealId };
  });
}

/** Merge duplicate lead `sourceId` into `targetId`: moves history, soft-deletes the source. */
export async function mergeLeads(user: SessionUser, targetId: string, sourceId: string) {
  assertWrite(user);
  if (targetId === sourceId) throw new Error("Cannot merge a lead into itself");
  const [target, source] = await Promise.all([
    db.lead.findFirst({ where: { id: targetId, deletedAt: null } }),
    db.lead.findFirst({ where: { id: sourceId, deletedAt: null } }),
  ]);
  if (!target || !source) throw new AuthError("Not found");
  await assertCanAccessOwned(user, target);
  await assertCanAccessOwned(user, source);

  await db.$transaction(async (tx) => {
    await tx.activity.updateMany({ where: { leadId: sourceId }, data: { leadId: targetId } });
    await tx.task.updateMany({ where: { leadId: sourceId }, data: { leadId: targetId } });
    await tx.document.updateMany({ where: { leadId: sourceId }, data: { leadId: targetId } });
    // fill blank fields on target from source
    await tx.lead.update({
      where: { id: targetId },
      data: {
        email: target.email ?? source.email,
        phone: target.phone ?? source.phone,
        company: target.company ?? source.company,
        campaign: target.campaign ?? source.campaign,
        score: Math.max(target.score, source.score),
        notes: [target.notes, source.notes].filter(Boolean).join("\n---\n") || null,
      },
    });
    await tx.lead.update({ where: { id: sourceId }, data: { deletedAt: new Date() } });
    await tx.auditLog.create({
      data: {
        action: "MERGE",
        entityType: "LEAD",
        entityId: targetId,
        entityLabel: `${target.firstName} ${target.lastName}`,
        actorId: user.id,
        actorEmail: user.email,
        after: { mergedFrom: sourceId },
      },
    });
  });
}
