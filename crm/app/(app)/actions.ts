"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { activityCreateSchema, taskCreateSchema } from "@/lib/validation";
import { logActivity } from "@/lib/services/activities";
import { createTask, completeTask, reopenTask, deleteTask } from "@/lib/services/tasks";
import { uploadDocument, deleteDocument } from "@/lib/services/documents";
import { db } from "@/lib/db";
import type { DocCategory } from "@prisma/client";

export type ActionResult = { ok: true; id?: string } | { ok: false; error: string };

function fail(e: unknown): ActionResult {
  const msg = e instanceof Error ? e.message : "Something went wrong";
  return { ok: false, error: msg };
}

export async function logActivityAction(input: unknown, path?: string): Promise<ActionResult> {
  try {
    const user = await requireUser();
    const parsed = activityCreateSchema.parse(input);
    const activity = await logActivity(user, parsed);
    if (path) revalidatePath(path);
    return { ok: true, id: activity.id };
  } catch (e) {
    return fail(e);
  }
}

export async function createTaskAction(input: unknown, path?: string): Promise<ActionResult> {
  try {
    const user = await requireUser();
    const parsed = taskCreateSchema.parse(input);
    const task = await createTask(user, parsed);
    if (path) revalidatePath(path);
    return { ok: true, id: task.id };
  } catch (e) {
    return fail(e);
  }
}

export async function completeTaskAction(taskId: string, path?: string): Promise<ActionResult> {
  try {
    const user = await requireUser();
    await completeTask(user, taskId);
    if (path) revalidatePath(path);
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function reopenTaskAction(taskId: string, path?: string): Promise<ActionResult> {
  try {
    const user = await requireUser();
    await reopenTask(user, taskId);
    if (path) revalidatePath(path);
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function deleteTaskAction(taskId: string, path?: string): Promise<ActionResult> {
  try {
    const user = await requireUser();
    await deleteTask(user, taskId);
    if (path) revalidatePath(path);
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function uploadDocumentAction(formData: FormData): Promise<ActionResult> {
  try {
    const user = await requireUser();
    const file = formData.get("file") as File | null;
    if (!file) return { ok: false, error: "No file provided" };
    const doc = await uploadDocument(user, {
      file,
      category: (formData.get("category") as DocCategory) || "OTHER",
      documentId: (formData.get("documentId") as string) || undefined,
      name: (formData.get("name") as string) || undefined,
      link: {
        leadId: (formData.get("leadId") as string) || null,
        accountId: (formData.get("accountId") as string) || null,
        contactId: (formData.get("contactId") as string) || null,
        dealId: (formData.get("dealId") as string) || null,
      },
    });
    const path = formData.get("path") as string | null;
    if (path) revalidatePath(path);
    return { ok: true, id: doc.id };
  } catch (e) {
    return fail(e);
  }
}

export async function deleteDocumentAction(documentId: string, path?: string): Promise<ActionResult> {
  try {
    const user = await requireUser();
    await deleteDocument(user, documentId);
    if (path) revalidatePath(path);
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function markNotificationsRead(ids?: string[]): Promise<ActionResult> {
  try {
    const user = await requireUser();
    await db.notification.updateMany({
      where: { userId: user.id, readAt: null, ...(ids ? { id: { in: ids } } : {}) },
      data: { readAt: new Date() },
    });
    revalidatePath("/notifications");
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}
