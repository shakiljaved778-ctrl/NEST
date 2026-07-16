import { Prisma } from "@prisma/client";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { AuthError } from "@/lib/auth";
import { assertAdmin, type SessionUser } from "@/lib/rbac";
import { logAudit } from "@/lib/audit";

// ─── Users & teams ───────────────────────────────────────────────────────────

export async function createUser(
  admin: SessionUser,
  input: { email: string; name: string; role: string; teamId?: string | null; territory?: string | null; quotaMonthly?: number; password: string }
) {
  assertAdmin(admin);
  const existing = await db.user.findUnique({ where: { email: input.email.toLowerCase() } });
  if (existing) throw new Error("A user with this email already exists");
  const user = await db.user.create({
    data: {
      email: input.email.toLowerCase(),
      name: input.name,
      role: input.role as Prisma.UserCreateInput["role"],
      teamId: input.teamId ?? null,
      territory: input.territory ?? null,
      quotaMonthly: input.quotaMonthly ?? 0,
      passwordHash: await bcrypt.hash(input.password, 10),
    },
  });
  await logAudit({ action: "CREATE", entityType: "USER", entityId: user.id, entityLabel: user.email, actorId: admin.id, actorEmail: admin.email, after: { role: user.role } });
  return user;
}

export async function updateUser(admin: SessionUser, id: string, data: Record<string, unknown>) {
  assertAdmin(admin);
  const before = await db.user.findUnique({ where: { id } });
  if (!before) throw new AuthError("Not found");
  if (data.password) {
    data.passwordHash = await bcrypt.hash(data.password as string, 10);
    delete data.password;
  }
  const after = await db.user.update({ where: { id }, data: data as Prisma.UserUpdateInput });
  await logAudit({ action: "UPDATE", entityType: "USER", entityId: id, entityLabel: after.email, actorId: admin.id, actorEmail: admin.email, after: { role: after.role, active: after.active, onLeave: after.onLeave } });
  return after;
}

/**
 * Deactivate a user and optionally reassign all their open records to another
 * user (records-reassignment wizard).
 */
export async function deactivateUser(admin: SessionUser, userId: string, reassignToId?: string) {
  assertAdmin(admin);
  if (userId === admin.id) throw new Error("You cannot deactivate your own account");
  const target = await db.user.findUnique({ where: { id: userId } });
  if (!target) throw new AuthError("Not found");

  await db.user.update({ where: { id: userId }, data: { active: false } });

  let reassigned = 0;
  if (reassignToId) {
    const dest = await db.user.findUnique({ where: { id: reassignToId, active: true } });
    if (!dest) throw new Error("Reassignment target must be an active user");
    const [l, a, c, d, t] = await db.$transaction([
      db.lead.updateMany({ where: { ownerId: userId, status: { notIn: ["CONVERTED", "DISQUALIFIED"] }, deletedAt: null }, data: { ownerId: reassignToId, teamId: dest.teamId } }),
      db.account.updateMany({ where: { ownerId: userId, deletedAt: null }, data: { ownerId: reassignToId } }),
      db.contact.updateMany({ where: { ownerId: userId, deletedAt: null }, data: { ownerId: reassignToId } }),
      db.deal.updateMany({ where: { ownerId: userId, status: "OPEN", deletedAt: null }, data: { ownerId: reassignToId, teamId: dest.teamId } }),
      db.task.updateMany({ where: { ownerId: userId, status: "OPEN", deletedAt: null }, data: { ownerId: reassignToId } }),
    ]);
    reassigned = l.count + a.count + c.count + d.count + t.count;
  }

  await logAudit({
    action: "UPDATE", entityType: "USER", entityId: userId, entityLabel: target.email,
    actorId: admin.id, actorEmail: admin.email,
    after: { active: false, reassignedTo: reassignToId ?? null, reassignedRecords: reassigned },
  });
  return { reassigned };
}

export async function createTeam(admin: SessionUser, input: { name: string; territory?: string; productLine?: string; teamLeadId?: string }) {
  assertAdmin(admin);
  const team = await db.team.create({
    data: { name: input.name, territory: input.territory ?? null, productLine: input.productLine ?? null, teamLeadId: input.teamLeadId ?? null },
  });
  await logAudit({ action: "CREATE", entityType: "TEAM", entityId: team.id, entityLabel: team.name, actorId: admin.id, actorEmail: admin.email });
  return team;
}

export async function updateTeam(admin: SessionUser, id: string, data: Record<string, unknown>) {
  assertAdmin(admin);
  const team = await db.team.update({ where: { id }, data: data as Prisma.TeamUpdateInput });
  await logAudit({ action: "UPDATE", entityType: "TEAM", entityId: id, entityLabel: team.name, actorId: admin.id, actorEmail: admin.email });
  return team;
}

// ─── Products ────────────────────────────────────────────────────────────────

export async function upsertProduct(admin: SessionUser, input: { id?: string; name: string; description?: string; pricingModel: string; price: number; active?: boolean }) {
  assertAdmin(admin);
  const data = {
    name: input.name,
    description: input.description ?? null,
    pricingModel: input.pricingModel as Prisma.ProductCreateInput["pricingModel"],
    price: input.price,
    active: input.active ?? true,
  };
  const product = input.id
    ? await db.product.update({ where: { id: input.id }, data })
    : await db.product.create({ data });
  await logAudit({ action: input.id ? "UPDATE" : "CREATE", entityType: "PRODUCT", entityId: product.id, entityLabel: product.name, actorId: admin.id, actorEmail: admin.email });
  return product;
}

// ─── Pipelines & stages ──────────────────────────────────────────────────────

export async function createPipeline(admin: SessionUser, name: string) {
  assertAdmin(admin);
  const pipeline = await db.pipeline.create({
    data: {
      name,
      stages: {
        create: [
          { name: "Qualified", sortOrder: 0, probability: 10, type: "OPEN" },
          { name: "Closed Won", sortOrder: 1, probability: 100, type: "WON" },
          { name: "Closed Lost", sortOrder: 2, probability: 0, type: "LOST" },
        ],
      },
    },
  });
  await logAudit({ action: "CREATE", entityType: "PIPELINE", entityId: pipeline.id, entityLabel: pipeline.name, actorId: admin.id, actorEmail: admin.email });
  return pipeline;
}

export async function upsertStage(admin: SessionUser, input: { id?: string; pipelineId: string; name: string; probability: number; type: string; sortOrder: number }) {
  assertAdmin(admin);
  const data = {
    name: input.name,
    probability: input.probability,
    type: input.type as Prisma.StageCreateInput["type"],
    sortOrder: input.sortOrder,
  };
  const stage = input.id
    ? await db.stage.update({ where: { id: input.id }, data })
    : await db.stage.create({ data: { ...data, pipelineId: input.pipelineId } });
  await logAudit({ action: input.id ? "UPDATE" : "CREATE", entityType: "STAGE", entityId: stage.id, entityLabel: stage.name, actorId: admin.id, actorEmail: admin.email });
  return stage;
}

export async function deleteStage(admin: SessionUser, id: string) {
  assertAdmin(admin);
  const dealCount = await db.deal.count({ where: { stageId: id, deletedAt: null } });
  if (dealCount > 0) throw new Error(`Cannot delete a stage with ${dealCount} deals — move them first`);
  await db.stage.update({ where: { id }, data: { deletedAt: new Date() } });
  await logAudit({ action: "DELETE", entityType: "STAGE", entityId: id, actorId: admin.id, actorEmail: admin.email });
}

// ─── KYC checklist config ────────────────────────────────────────────────────

export async function upsertKycItem(admin: SessionUser, input: { id?: string; name: string; appliesTo: string; required: boolean; sortOrder: number; active?: boolean }) {
  assertAdmin(admin);
  const data = {
    name: input.name,
    appliesTo: input.appliesTo as Prisma.KycChecklistItemCreateInput["appliesTo"],
    required: input.required,
    sortOrder: input.sortOrder,
    active: input.active ?? true,
  };
  const item = input.id
    ? await db.kycChecklistItem.update({ where: { id: input.id }, data })
    : await db.kycChecklistItem.create({ data });
  await logAudit({ action: input.id ? "UPDATE" : "CREATE", entityType: "KYC_ITEM", entityId: item.id, entityLabel: item.name, actorId: admin.id, actorEmail: admin.email });
  return item;
}

// ─── Routing rules ───────────────────────────────────────────────────────────

export async function upsertRoutingRule(admin: SessionUser, input: Record<string, unknown> & { id?: string }) {
  assertAdmin(admin);
  const data = {
    name: input.name as string,
    priority: input.priority as number,
    active: (input.active as boolean) ?? true,
    isFallback: (input.isFallback as boolean) ?? false,
    criteria: (input.criteria ?? {}) as Prisma.InputJsonValue,
    targetType: input.targetType as Prisma.LeadRoutingRuleCreateInput["targetType"],
    targetRepId: (input.targetRepId as string) || null,
    targetTeamId: (input.targetTeamId as string) || null,
  };
  const rule = input.id
    ? await db.leadRoutingRule.update({ where: { id: input.id }, data })
    : await db.leadRoutingRule.create({ data });
  await logAudit({ action: input.id ? "UPDATE" : "CREATE", entityType: "ROUTING_RULE", entityId: rule.id, entityLabel: rule.name, actorId: admin.id, actorEmail: admin.email });
  return rule;
}

export async function deleteRoutingRule(admin: SessionUser, id: string) {
  assertAdmin(admin);
  await db.leadRoutingRule.update({ where: { id }, data: { deletedAt: new Date() } });
  await logAudit({ action: "DELETE", entityType: "ROUTING_RULE", entityId: id, actorId: admin.id, actorEmail: admin.email });
}

// ─── Custom fields ───────────────────────────────────────────────────────────

export async function upsertCustomField(admin: SessionUser, input: { id?: string; entity: string; key: string; label: string; type: string; options?: string[]; required?: boolean; sortOrder?: number; active?: boolean }) {
  assertAdmin(admin);
  const data = {
    entity: input.entity as Prisma.CustomFieldDefinitionCreateInput["entity"],
    key: input.key.replace(/[^a-zA-Z0-9_]/g, "_"),
    label: input.label,
    type: input.type as Prisma.CustomFieldDefinitionCreateInput["type"],
    options: (input.options ?? []) as Prisma.InputJsonValue,
    required: input.required ?? false,
    sortOrder: input.sortOrder ?? 0,
    active: input.active ?? true,
  };
  const field = input.id
    ? await db.customFieldDefinition.update({ where: { id: input.id }, data })
    : await db.customFieldDefinition.create({ data });
  await logAudit({ action: input.id ? "UPDATE" : "CREATE", entityType: "CUSTOM_FIELD", entityId: field.id, entityLabel: field.label, actorId: admin.id, actorEmail: admin.email });
  return field;
}

export async function deleteCustomField(admin: SessionUser, id: string) {
  assertAdmin(admin);
  await db.customFieldDefinition.delete({ where: { id } });
  await logAudit({ action: "DELETE", entityType: "CUSTOM_FIELD", entityId: id, actorId: admin.id, actorEmail: admin.email });
}

// ─── Soft-delete restore ─────────────────────────────────────────────────────

export async function restoreEntity(admin: SessionUser, entity: string, id: string) {
  assertAdmin(admin);
  const models: Record<string, { update: (args: { where: { id: string }; data: { deletedAt: null } }) => Promise<unknown> }> = {
    LEAD: db.lead, ACCOUNT: db.account, CONTACT: db.contact, DEAL: db.deal, TASK: db.task, DOCUMENT: db.document,
  };
  const model = models[entity];
  if (!model) throw new Error("Entity not restorable");
  await model.update({ where: { id }, data: { deletedAt: null } });
  await logAudit({ action: "RESTORE", entityType: entity as Prisma.AuditLogCreateInput["entityType"], entityId: id, actorId: admin.id, actorEmail: admin.email });
}
