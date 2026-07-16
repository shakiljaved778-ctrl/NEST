"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { leadCreateSchema, leadUpdateSchema, convertLeadSchema, savedViewSchema } from "@/lib/validation";
import {
  createLead,
  updateLead,
  bulkLeadAction,
  convertLead,
  mergeLeads,
  findDuplicateLeads,
} from "@/lib/services/leads";
import type { ActionResult } from "@/app/(app)/actions";
import type { LeadStatus } from "@prisma/client";

function fail(e: unknown): ActionResult {
  return { ok: false, error: e instanceof Error ? e.message : "Something went wrong" };
}

export async function checkDuplicatesAction(email?: string, phone?: string, excludeId?: string) {
  await requireUser();
  return findDuplicateLeads(email, phone, excludeId);
}

export async function createLeadAction(input: unknown): Promise<ActionResult> {
  try {
    const user = await requireUser();
    const parsed = leadCreateSchema.parse(input);
    const lead = await createLead(user, parsed);
    revalidatePath("/leads");
    return { ok: true, id: lead.id };
  } catch (e) {
    return fail(e);
  }
}

export async function updateLeadAction(id: string, input: unknown): Promise<ActionResult> {
  try {
    const user = await requireUser();
    const parsed = leadUpdateSchema.parse(input);
    await updateLead(user, id, parsed);
    revalidatePath(`/leads/${id}`);
    revalidatePath("/leads");
    return { ok: true, id };
  } catch (e) {
    return fail(e);
  }
}

export async function bulkLeadActionServer(
  ids: string[],
  action:
    | { type: "assign"; ownerId: string }
    | { type: "status"; status: LeadStatus; reason?: string }
    | { type: "delete" }
): Promise<ActionResult> {
  try {
    const user = await requireUser();
    const count = await bulkLeadAction(user, ids, action);
    revalidatePath("/leads");
    return { ok: true, id: String(count) };
  } catch (e) {
    return fail(e);
  }
}

export async function convertLeadAction(input: unknown): Promise<ActionResult & { dealId?: string | null; contactId?: string }> {
  try {
    const user = await requireUser();
    const parsed = convertLeadSchema.parse(input);
    const result = await convertLead(user, parsed);
    revalidatePath("/leads");
    revalidatePath(`/leads/${parsed.leadId}`);
    return { ok: true, id: parsed.leadId, dealId: result.dealId, contactId: result.contactId };
  } catch (e) {
    return fail(e);
  }
}

export async function mergeLeadsAction(targetId: string, sourceId: string): Promise<ActionResult> {
  try {
    const user = await requireUser();
    await mergeLeads(user, targetId, sourceId);
    revalidatePath("/leads");
    revalidatePath(`/leads/${targetId}`);
    return { ok: true, id: targetId };
  } catch (e) {
    return fail(e);
  }
}

export async function saveViewAction(input: unknown): Promise<ActionResult> {
  try {
    const user = await requireUser();
    const parsed = savedViewSchema.parse(input);
    const view = await db.savedView.create({
      data: {
        userId: user.id,
        entity: parsed.entity,
        name: parsed.name,
        filters: parsed.filters as never,
        shared: parsed.shared,
      },
    });
    revalidatePath(`/${parsed.entity}s`);
    return { ok: true, id: view.id };
  } catch (e) {
    return fail(e);
  }
}

export async function deleteViewAction(id: string): Promise<ActionResult> {
  try {
    const user = await requireUser();
    await db.savedView.deleteMany({ where: { id, userId: user.id } });
    revalidatePath("/leads");
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}
