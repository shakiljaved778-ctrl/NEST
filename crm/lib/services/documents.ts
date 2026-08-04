import type { DocCategory } from "@prisma/client";
import { db } from "@/lib/db";
import { AuthError } from "@/lib/auth";
import { assertWrite, canViewDocument, canAccessOwned, type SessionUser } from "@/lib/rbac";
import { logAudit } from "@/lib/audit";
import { storage, newStorageKey } from "@/lib/storage";

const MAX_SIZE = 10 * 1024 * 1024; // 10 MB
const ALLOWED_MIME = new Set([
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/webp",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/csv",
  "text/plain",
]);

export interface DocLink {
  leadId?: string | null;
  accountId?: string | null;
  contactId?: string | null;
  dealId?: string | null;
}

/** Resolve owner/team of the record a document is (being) linked to. */
async function linkedRecordOwner(link: DocLink): Promise<{ ownerId: string | null; teamId?: string | null }> {
  if (link.leadId) {
    const l = await db.lead.findUnique({ where: { id: link.leadId }, select: { ownerId: true, teamId: true } });
    if (!l) throw new AuthError("Linked lead not found");
    return l;
  }
  if (link.dealId) {
    const d = await db.deal.findUnique({ where: { id: link.dealId }, select: { ownerId: true, teamId: true } });
    if (!d) throw new AuthError("Linked deal not found");
    return d;
  }
  if (link.accountId) {
    const a = await db.account.findUnique({ where: { id: link.accountId }, select: { ownerId: true } });
    if (!a) throw new AuthError("Linked account not found");
    return a;
  }
  if (link.contactId) {
    const c = await db.contact.findUnique({ where: { id: link.contactId }, select: { ownerId: true } });
    if (!c) throw new AuthError("Linked contact not found");
    return c;
  }
  throw new AuthError("Document must be linked to a record");
}

export async function uploadDocument(
  user: SessionUser,
  params: {
    file: File;
    category: DocCategory;
    link: DocLink;
    /** re-upload: create a new version of this existing document */
    documentId?: string;
    name?: string;
  }
) {
  assertWrite(user);
  const { file, category, link } = params;
  if (file.size === 0 || file.size > MAX_SIZE) throw new Error("File must be between 1 byte and 10 MB");
  const mime = file.type || "application/octet-stream";
  if (!ALLOWED_MIME.has(mime)) throw new Error(`File type not allowed: ${mime}`);

  const recordOwner = await linkedRecordOwner(link);
  if (!(await canAccessOwned(user, recordOwner))) throw new AuthError("Forbidden");

  const data = Buffer.from(await file.arrayBuffer());
  const key = newStorageKey(file.name);
  await storage().put(key, data, mime);

  if (params.documentId) {
    // new version of an existing document
    const doc = await db.document.findFirst({ where: { id: params.documentId, deletedAt: null } });
    if (!doc) throw new AuthError("Document not found");
    if (!(await canViewDocument(user, { category: doc.category, ...recordOwner }))) throw new AuthError("Forbidden");
    const version = doc.version + 1;
    const [updated] = await db.$transaction([
      db.document.update({
        where: { id: doc.id },
        data: { storageKey: key, mime, size: data.length, version, name: params.name || doc.name },
      }),
      db.documentVersion.create({
        data: { documentId: doc.id, version, storageKey: key, mime, size: data.length, uploadedById: user.id },
      }),
    ]);
    await logAudit({
      action: "UPDATE", entityType: "DOCUMENT", entityId: doc.id, entityLabel: updated.name,
      actorId: user.id, actorEmail: user.email, after: { version, size: data.length },
    });
    return updated;
  }

  const doc = await db.document.create({
    data: {
      name: params.name || file.name,
      category,
      mime,
      size: data.length,
      storageKey: key,
      version: 1,
      uploadedById: user.id,
      leadId: link.leadId ?? null,
      accountId: link.accountId ?? null,
      contactId: link.contactId ?? null,
      dealId: link.dealId ?? null,
      versions: {
        create: [{ version: 1, storageKey: key, mime, size: data.length, uploadedById: user.id }],
      },
    },
  });
  await logAudit({
    action: "CREATE", entityType: "DOCUMENT", entityId: doc.id, entityLabel: doc.name,
    actorId: user.id, actorEmail: user.email, after: { category, size: data.length },
  });
  return doc;
}

/** Fetch document bytes for preview/download. Enforces ACL and audit-logs the access. */
export async function readDocument(
  user: SessionUser,
  documentId: string,
  opts: { version?: number; disposition: "VIEW" | "DOWNLOAD" }
) {
  const doc = await db.document.findFirst({
    where: { id: documentId, deletedAt: null },
    include: {
      lead: { select: { ownerId: true, teamId: true } },
      deal: { select: { ownerId: true, teamId: true } },
      account: { select: { ownerId: true } },
      contact: { select: { ownerId: true } },
      versions: { orderBy: { version: "desc" } },
    },
  });
  if (!doc) throw new AuthError("Not found");

  const recordOwner = doc.lead ?? doc.deal ?? doc.account ?? doc.contact ?? { ownerId: null };
  if (!(await canViewDocument(user, { category: doc.category, ...recordOwner }))) {
    throw new AuthError("Forbidden");
  }

  const version = opts.version
    ? doc.versions.find((v) => v.version === opts.version)
    : doc.versions[0];
  if (!version) throw new AuthError("Version not found");

  const bytes = await storage().get(version.storageKey);

  await logAudit({
    action: opts.disposition === "DOWNLOAD" ? "DOWNLOAD" : "VIEW",
    entityType: "DOCUMENT",
    entityId: doc.id,
    entityLabel: doc.name,
    actorId: user.id,
    actorEmail: user.email,
    after: { version: version.version, category: doc.category },
  });

  return { doc, version, bytes };
}

export async function deleteDocument(user: SessionUser, documentId: string) {
  assertWrite(user);
  const doc = await db.document.findFirst({
    where: { id: documentId, deletedAt: null },
    include: {
      lead: { select: { ownerId: true, teamId: true } },
      deal: { select: { ownerId: true, teamId: true } },
      account: { select: { ownerId: true } },
      contact: { select: { ownerId: true } },
    },
  });
  if (!doc) throw new AuthError("Not found");
  const recordOwner = doc.lead ?? doc.deal ?? doc.account ?? doc.contact ?? { ownerId: null };
  if (!(await canViewDocument(user, { category: doc.category, ...recordOwner }))) throw new AuthError("Forbidden");
  await db.document.update({ where: { id: documentId }, data: { deletedAt: new Date() } });
  await logAudit({
    action: "DELETE", entityType: "DOCUMENT", entityId: documentId, entityLabel: doc.name,
    actorId: user.id, actorEmail: user.email,
  });
}
