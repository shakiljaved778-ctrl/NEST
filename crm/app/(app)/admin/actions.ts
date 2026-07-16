"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import * as admin from "@/lib/services/admin";
import { setSetting } from "@/lib/settings";
import { eraseClient } from "@/lib/services/clients";
import { routingRuleSchema } from "@/lib/validation";
import { logAudit } from "@/lib/audit";
import type { ActionResult } from "@/app/(app)/actions";

function fail(e: unknown): ActionResult {
  return { ok: false, error: e instanceof Error ? e.message : "Something went wrong" };
}

async function adminUser() {
  return requireRole("ADMIN");
}

export async function createUserAction(input: {
  email: string; name: string; role: string; teamId?: string | null; territory?: string | null; quotaMonthly?: number; password: string;
}): Promise<ActionResult> {
  try {
    const user = await adminUser();
    const created = await admin.createUser(user, input);
    revalidatePath("/admin/users");
    return { ok: true, id: created.id };
  } catch (e) {
    return fail(e);
  }
}

export async function updateUserAction(id: string, data: Record<string, unknown>): Promise<ActionResult> {
  try {
    const user = await adminUser();
    await admin.updateUser(user, id, data);
    revalidatePath("/admin/users");
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function deactivateUserAction(userId: string, reassignToId?: string): Promise<ActionResult> {
  try {
    const user = await adminUser();
    const { reassigned } = await admin.deactivateUser(user, userId, reassignToId);
    revalidatePath("/admin/users");
    return { ok: true, id: String(reassigned) };
  } catch (e) {
    return fail(e);
  }
}

export async function createTeamAction(input: { name: string; territory?: string; productLine?: string; teamLeadId?: string }): Promise<ActionResult> {
  try {
    const user = await adminUser();
    const team = await admin.createTeam(user, input);
    revalidatePath("/admin/teams");
    return { ok: true, id: team.id };
  } catch (e) {
    return fail(e);
  }
}

export async function updateTeamAction(id: string, data: Record<string, unknown>): Promise<ActionResult> {
  try {
    const user = await adminUser();
    await admin.updateTeam(user, id, data);
    revalidatePath("/admin/teams");
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function upsertProductAction(input: { id?: string; name: string; description?: string; pricingModel: string; price: number; active?: boolean }): Promise<ActionResult> {
  try {
    const user = await adminUser();
    const p = await admin.upsertProduct(user, input);
    revalidatePath("/admin/products");
    return { ok: true, id: p.id };
  } catch (e) {
    return fail(e);
  }
}

export async function createPipelineAction(name: string): Promise<ActionResult> {
  try {
    const user = await adminUser();
    const p = await admin.createPipeline(user, name);
    revalidatePath("/admin/pipelines");
    return { ok: true, id: p.id };
  } catch (e) {
    return fail(e);
  }
}

export async function upsertStageAction(input: { id?: string; pipelineId: string; name: string; probability: number; type: string; sortOrder: number }): Promise<ActionResult> {
  try {
    const user = await adminUser();
    await admin.upsertStage(user, input);
    revalidatePath("/admin/pipelines");
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function deleteStageAction(id: string): Promise<ActionResult> {
  try {
    const user = await adminUser();
    await admin.deleteStage(user, id);
    revalidatePath("/admin/pipelines");
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function upsertKycItemAction(input: { id?: string; name: string; appliesTo: string; required: boolean; sortOrder: number; active?: boolean }): Promise<ActionResult> {
  try {
    const user = await adminUser();
    await admin.upsertKycItem(user, input);
    revalidatePath("/admin/kyc");
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function upsertRoutingRuleAction(input: unknown): Promise<ActionResult> {
  try {
    const user = await adminUser();
    const parsed = routingRuleSchema.parse(input);
    const id = (input as { id?: string }).id;
    await admin.upsertRoutingRule(user, { ...parsed, id });
    revalidatePath("/admin/routing");
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function deleteRoutingRuleAction(id: string): Promise<ActionResult> {
  try {
    const user = await adminUser();
    await admin.deleteRoutingRule(user, id);
    revalidatePath("/admin/routing");
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function upsertCustomFieldAction(input: { id?: string; entity: string; key: string; label: string; type: string; options?: string[]; required?: boolean }): Promise<ActionResult> {
  try {
    const user = await adminUser();
    await admin.upsertCustomField(user, input);
    revalidatePath("/admin/custom-fields");
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function deleteCustomFieldAction(id: string): Promise<ActionResult> {
  try {
    const user = await adminUser();
    await admin.deleteCustomField(user, id);
    revalidatePath("/admin/custom-fields");
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function saveSlaSettingsAction(input: { firstTouchMinutes: number; escalateAfterMinutes: number; reassignOnEscalate: boolean }): Promise<ActionResult> {
  try {
    const user = await adminUser();
    await setSetting("sla", input);
    await logAudit({ action: "UPDATE", entityType: "SETTING", entityId: "sla", actorId: user.id, actorEmail: user.email, after: input });
    revalidatePath("/admin/routing");
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function restoreEntityAction(entity: string, id: string): Promise<ActionResult> {
  try {
    const user = await adminUser();
    await admin.restoreEntity(user, entity, id);
    revalidatePath("/admin/recycle-bin");
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function eraseClientAction(clientType: "account" | "contact", clientId: string): Promise<ActionResult> {
  try {
    const user = await adminUser();
    await eraseClient(user, clientType, clientId);
    revalidatePath("/clients");
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}
