import { Prisma, type ClientStatus } from "@prisma/client";
import { db } from "@/lib/db";
import { AuthError } from "@/lib/auth";
import {
  accountScope,
  contactScope,
  assertWrite,
  assertCanAccessOwned,
  isManagerial,
  type SessionUser,
} from "@/lib/rbac";
import { logAudit, diffForAudit } from "@/lib/audit";
import { encryptField, decryptField, last3 } from "@/lib/crypto";
import { normalizeEmail } from "@/lib/utils";
import type { z } from "zod";
import type { accountSchema, contactSchema } from "@/lib/validation";

// ─── Accounts (B2B) ──────────────────────────────────────────────────────────

export interface ClientFilters {
  q?: string;
  type?: "all" | "account" | "contact";
  status?: string;
  territory?: string;
  ownerId?: string;
  page?: number;
  pageSize?: number;
}

export async function listAccounts(user: SessionUser, filters: ClientFilters) {
  const scope = await accountScope(user);
  const where: Prisma.AccountWhereInput = { deletedAt: null, AND: [scope] };
  if (filters.status) where.status = filters.status as ClientStatus;
  if (filters.territory) where.territory = filters.territory;
  if (filters.ownerId) where.ownerId = filters.ownerId;
  if (filters.q) {
    where.OR = [
      { legalName: { contains: filters.q, mode: "insensitive" } },
      { tradeName: { contains: filters.q, mode: "insensitive" } },
      { crNumber: { contains: filters.q, mode: "insensitive" } },
    ];
  }
  return db.account.findMany({
    where,
    include: { owner: { select: { name: true } }, _count: { select: { contacts: true, deals: true, subscriptions: true } } },
    orderBy: { legalName: "asc" },
    take: 1000,
  });
}

/** Standalone B2C contacts (no account) for the unified clients list. */
export async function listB2cContacts(user: SessionUser, filters: ClientFilters) {
  const scope = await contactScope(user);
  const where: Prisma.ContactWhereInput = { deletedAt: null, accountId: null, clientStatus: { not: null }, AND: [scope] };
  if (filters.status) where.clientStatus = filters.status as ClientStatus;
  if (filters.ownerId) where.ownerId = filters.ownerId;
  if (filters.q) {
    where.OR = [
      { firstName: { contains: filters.q, mode: "insensitive" } },
      { lastName: { contains: filters.q, mode: "insensitive" } },
      { email: { contains: filters.q, mode: "insensitive" } },
    ];
  }
  return db.contact.findMany({
    where,
    include: { owner: { select: { name: true } }, _count: { select: { subscriptions: true } } },
    orderBy: { firstName: "asc" },
    take: 1000,
  });
}

export async function getAccount(user: SessionUser, id: string) {
  const account = await db.account.findFirst({
    where: { id, deletedAt: null },
    include: {
      owner: { select: { id: true, name: true } },
      contacts: { where: { deletedAt: null }, orderBy: { firstName: "asc" } },
      deals: {
        where: { deletedAt: null },
        include: { stage: { select: { name: true, type: true } } },
        orderBy: { updatedAt: "desc" },
      },
      subscriptions: { where: { deletedAt: null }, include: { product: { select: { name: true } } }, orderBy: { renewalDate: "asc" } },
      activities: { where: { deletedAt: null }, include: { user: { select: { name: true } } }, orderBy: { occurredAt: "desc" }, take: 100 },
      tasks: { where: { deletedAt: null }, include: { owner: { select: { name: true } } }, orderBy: { dueAt: "asc" } },
      documents: { where: { deletedAt: null }, include: { uploadedBy: { select: { name: true } } }, orderBy: { updatedAt: "desc" } },
      kycStatuses: { include: { checklistItem: true, document: { select: { name: true } } } },
    },
  });
  if (!account) return null;
  await assertCanAccessOwned(user, account);
  return account;
}

export async function getContact(user: SessionUser, id: string) {
  const contact = await db.contact.findFirst({
    where: { id, deletedAt: null },
    include: {
      owner: { select: { id: true, name: true } },
      account: { select: { id: true, legalName: true } },
      dealsPrimary: { where: { deletedAt: null }, include: { stage: { select: { name: true, type: true } } }, orderBy: { updatedAt: "desc" } },
      subscriptions: { where: { deletedAt: null }, include: { product: { select: { name: true } } }, orderBy: { renewalDate: "asc" } },
      activities: { where: { deletedAt: null }, include: { user: { select: { name: true } } }, orderBy: { occurredAt: "desc" }, take: 100 },
      tasks: { where: { deletedAt: null }, include: { owner: { select: { name: true } } }, orderBy: { dueAt: "asc" } },
      documents: { where: { deletedAt: null }, include: { uploadedBy: { select: { name: true } } }, orderBy: { updatedAt: "desc" } },
      kycStatuses: { include: { checklistItem: true, document: { select: { name: true } } } },
    },
  });
  if (!contact) return null;
  await assertCanAccessOwned(user, contact);
  return contact;
}

export async function createAccount(user: SessionUser, input: z.infer<typeof accountSchema>) {
  assertWrite(user);
  const account = await db.account.create({
    data: {
      legalName: input.legalName,
      tradeName: input.tradeName ?? null,
      crNumber: input.crNumber ?? null,
      industry: input.industry ?? null,
      size: input.size ?? null,
      website: input.website ?? null,
      address: input.address ?? null,
      city: input.city ?? null,
      territory: input.territory ?? user.territory ?? null,
      status: input.status,
      ownerId: input.ownerId ?? user.id,
      customFields: (input.customFields ?? {}) as Prisma.InputJsonValue,
    },
  });
  await logAudit({
    action: "CREATE", entityType: "ACCOUNT", entityId: account.id, entityLabel: account.legalName,
    actorId: user.id, actorEmail: user.email, after: { status: account.status },
  });
  return account;
}

export async function updateAccount(user: SessionUser, id: string, input: Partial<z.infer<typeof accountSchema>>) {
  assertWrite(user);
  const before = await db.account.findFirst({ where: { id, deletedAt: null } });
  if (!before) throw new AuthError("Not found");
  await assertCanAccessOwned(user, before);
  const after = await db.account.update({ where: { id }, data: input as Prisma.AccountUpdateInput });
  const { before: b, after: a } = diffForAudit(before as never, after as never);
  await logAudit({
    action: "UPDATE", entityType: "ACCOUNT", entityId: id, entityLabel: after.legalName,
    actorId: user.id, actorEmail: user.email, before: b, after: a,
  });
  return after;
}

// ─── Contacts ────────────────────────────────────────────────────────────────

/** Encrypt QID/passport and derive last-3 for masked display. */
function idFields(nationalId: string | null | undefined, idDocType: string | null | undefined) {
  const docType = (idDocType === "PASSPORT" ? "PASSPORT" : "QID") as Prisma.ContactCreateInput["idDocType"];
  if (!nationalId) return { nationalIdEnc: null, nationalIdLast3: null, idDocType: idDocType ? docType : null };
  return { nationalIdEnc: encryptField(nationalId), nationalIdLast3: last3(nationalId), idDocType: docType };
}

export async function createContact(user: SessionUser, input: z.infer<typeof contactSchema>) {
  assertWrite(user);
  const contact = await db.contact.create({
    data: {
      firstName: input.firstName,
      lastName: input.lastName,
      accountId: input.accountId ?? null,
      clientStatus: input.accountId ? null : (input.clientStatus ?? "PROSPECT"),
      position: input.position ?? null,
      email: normalizeEmail(input.email),
      email2: normalizeEmail(input.email2),
      phone: input.phone ?? null,
      phone2: input.phone2 ?? null,
      ...idFields(input.nationalId, input.idDocType),
      nationality: input.nationality ?? null,
      preferredLanguage: input.preferredLanguage,
      ownerId: input.ownerId ?? user.id,
      lawfulBasis: input.lawfulBasis ?? null,
      consentAt: input.lawfulBasis ? new Date() : null,
      customFields: (input.customFields ?? {}) as Prisma.InputJsonValue,
    },
  });
  await logAudit({
    action: "CREATE", entityType: "CONTACT", entityId: contact.id, entityLabel: `${contact.firstName} ${contact.lastName}`,
    actorId: user.id, actorEmail: user.email,
  });
  return contact;
}

export async function updateContact(user: SessionUser, id: string, input: Partial<z.infer<typeof contactSchema>>) {
  assertWrite(user);
  const before = await db.contact.findFirst({ where: { id, deletedAt: null } });
  if (!before) throw new AuthError("Not found");
  await assertCanAccessOwned(user, before);

  const data: Prisma.ContactUpdateInput = { ...(input as Prisma.ContactUpdateInput) };
  if ("nationalId" in input) {
    const enc = idFields(input.nationalId, input.idDocType ?? before.idDocType);
    Object.assign(data, enc);
    delete (data as Record<string, unknown>).nationalId;
  }
  if (input.email !== undefined) data.email = normalizeEmail(input.email);

  const after = await db.contact.update({ where: { id }, data });
  const { before: b, after: a } = diffForAudit(before as never, after as never);
  await logAudit({
    action: "UPDATE", entityType: "CONTACT", entityId: id, entityLabel: `${after.firstName} ${after.lastName}`,
    actorId: user.id, actorEmail: user.email, before: b, after: a,
  });
  return after;
}

/**
 * Reveal a decrypted QID/passport number. Managers, admins, compliance
 * (READ_ONLY) and the record owner may reveal; every reveal is audit-logged.
 */
export async function revealNationalId(user: SessionUser, contactId: string): Promise<string> {
  const contact = await db.contact.findFirst({ where: { id: contactId, deletedAt: null } });
  if (!contact) throw new AuthError("Not found");
  await assertCanAccessOwned(user, contact);
  const allowed = isManagerial(user.role) || user.role === "READ_ONLY" || contact.ownerId === user.id || user.role === "TEAM_LEAD";
  if (!allowed) throw new AuthError("Not permitted to reveal identifiers");
  if (!contact.nationalIdEnc) return "";

  await logAudit({
    action: "REVEAL", entityType: "CONTACT", entityId: contactId,
    entityLabel: `${contact.firstName} ${contact.lastName}`,
    actorId: user.id, actorEmail: user.email, after: { field: contact.idDocType ?? "nationalId" },
  });
  return decryptField(contact.nationalIdEnc);
}

// ─── KYC checklist ───────────────────────────────────────────────────────────

/** Resolve the KYC checklist + per-client status for an account or contact. */
export async function getKycChecklist(
  clientType: "account" | "contact",
  clientId: string
): Promise<{ itemId: string; name: string; required: boolean; complete: boolean; documentName: string | null }[]> {
  const items = await db.kycChecklistItem.findMany({
    where: {
      active: true,
      appliesTo: clientType === "account" ? { in: ["ACCOUNT", "BOTH"] } : { in: ["CONTACT", "BOTH"] },
    },
    orderBy: { sortOrder: "asc" },
    include: {
      statuses: {
        where: clientType === "account" ? { accountId: clientId } : { contactId: clientId },
        include: { document: { select: { name: true } } },
      },
    },
  });
  return items.map((item) => {
    const status = item.statuses[0];
    return {
      itemId: item.id,
      name: item.name,
      required: item.required,
      complete: status?.complete ?? false,
      documentName: status?.document?.name ?? null,
    };
  });
}

export async function setKycStatus(
  user: SessionUser,
  params: { checklistItemId: string; accountId?: string; contactId?: string; complete: boolean; documentId?: string | null }
) {
  assertWrite(user);
  const where = params.accountId
    ? { checklistItemId_accountId: { checklistItemId: params.checklistItemId, accountId: params.accountId } }
    : { checklistItemId_contactId: { checklistItemId: params.checklistItemId, contactId: params.contactId! } };

  const record = await db.kycItemStatus.upsert({
    where: where as Prisma.KycItemStatusWhereUniqueInput,
    create: {
      checklistItemId: params.checklistItemId,
      accountId: params.accountId ?? null,
      contactId: params.contactId ?? null,
      complete: params.complete,
      documentId: params.documentId ?? null,
      completedById: params.complete ? user.id : null,
      completedAt: params.complete ? new Date() : null,
    },
    update: {
      complete: params.complete,
      documentId: params.documentId ?? undefined,
      completedById: params.complete ? user.id : null,
      completedAt: params.complete ? new Date() : null,
    },
  });
  await logAudit({
    action: "UPDATE", entityType: "KYC_ITEM", entityId: record.id,
    actorId: user.id, actorEmail: user.email,
    after: { complete: params.complete, accountId: params.accountId, contactId: params.contactId },
  });
  return record;
}

/** GDPR/PDPPL-style data export (JSON) for one client. Admin only. */
export async function exportClientData(user: SessionUser, clientType: "account" | "contact", clientId: string) {
  if (user.role !== "ADMIN") throw new AuthError("Admin only");
  const data =
    clientType === "account"
      ? await db.account.findUnique({
          where: { id: clientId },
          include: { contacts: true, deals: true, subscriptions: true, activities: true, documents: true, kycStatuses: true },
        })
      : await db.contact.findUnique({
          where: { id: clientId },
          include: { subscriptions: true, activities: true, documents: true, kycStatuses: true, dealsPrimary: true },
        });
  if (!data) throw new AuthError("Not found");

  // Decrypt identifiers for the subject-access export, and log it
  const exportPayload = JSON.parse(JSON.stringify(data));
  if (clientType === "contact" && "nationalIdEnc" in data && data.nationalIdEnc) {
    exportPayload.nationalId = decryptField(data.nationalIdEnc);
    delete exportPayload.nationalIdEnc;
  }
  if (clientType === "account" && Array.isArray((data as { contacts?: unknown }).contacts)) {
    exportPayload.contacts = (data as { contacts: { nationalIdEnc: string | null }[] }).contacts.map((c) => {
      const copy = { ...c } as Record<string, unknown>;
      if (c.nationalIdEnc) copy.nationalId = decryptField(c.nationalIdEnc);
      delete copy.nationalIdEnc;
      return copy;
    });
  }

  await logAudit({
    action: "EXPORT", entityType: clientType === "account" ? "ACCOUNT" : "CONTACT", entityId: clientId,
    actorId: user.id, actorEmail: user.email, after: { subjectAccessExport: true },
  });
  return exportPayload;
}

/** PDPPL hard-erase (right to erasure). Admin only; the request is audit-logged. */
export async function eraseClient(user: SessionUser, clientType: "account" | "contact", clientId: string) {
  if (user.role !== "ADMIN") throw new AuthError("Admin only");

  const label =
    clientType === "account"
      ? (await db.account.findUnique({ where: { id: clientId }, select: { legalName: true } }))?.legalName
      : (await db.contact.findUnique({ where: { id: clientId }, select: { firstName: true, lastName: true } }))
          ?.firstName;

  // Log the erasure BEFORE deleting so the audit trail survives (append-only)
  await logAudit({
    action: "ERASE",
    entityType: clientType === "account" ? "ACCOUNT" : "CONTACT",
    entityId: clientId,
    entityLabel: label ?? clientId,
    actorId: user.id,
    actorEmail: user.email,
    after: { hardErase: true, law: "Qatar Law No. 13 of 2016 (PDPPL)" },
  });

  if (clientType === "account") {
    await db.$transaction([
      db.kycItemStatus.deleteMany({ where: { accountId: clientId } }),
      db.contact.updateMany({ where: { accountId: clientId }, data: { accountId: null, deletedAt: new Date() } }),
      db.account.delete({ where: { id: clientId } }),
    ]);
  } else {
    await db.$transaction([
      db.kycItemStatus.deleteMany({ where: { contactId: clientId } }),
      db.contact.delete({ where: { id: clientId } }),
    ]);
  }
  return { erased: true };
}
