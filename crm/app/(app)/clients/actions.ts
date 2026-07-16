"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { accountSchema, contactSchema } from "@/lib/validation";
import {
  createAccount,
  updateAccount,
  createContact,
  updateContact,
  revealNationalId,
  setKycStatus,
} from "@/lib/services/clients";
import type { ActionResult } from "@/app/(app)/actions";

function fail(e: unknown): ActionResult {
  return { ok: false, error: e instanceof Error ? e.message : "Something went wrong" };
}

export async function createAccountAction(input: unknown): Promise<ActionResult> {
  try {
    const user = await requireUser();
    const parsed = accountSchema.parse(input);
    const account = await createAccount(user, parsed);
    revalidatePath("/clients");
    return { ok: true, id: account.id };
  } catch (e) {
    return fail(e);
  }
}

export async function updateAccountAction(id: string, input: unknown): Promise<ActionResult> {
  try {
    const user = await requireUser();
    const parsed = accountSchema.partial().parse(input);
    await updateAccount(user, id, parsed);
    revalidatePath(`/clients/accounts/${id}`);
    return { ok: true, id };
  } catch (e) {
    return fail(e);
  }
}

export async function createContactAction(input: unknown): Promise<ActionResult> {
  try {
    const user = await requireUser();
    const parsed = contactSchema.parse(input);
    const contact = await createContact(user, parsed);
    revalidatePath("/clients");
    return { ok: true, id: contact.id };
  } catch (e) {
    return fail(e);
  }
}

export async function updateContactAction(id: string, input: unknown): Promise<ActionResult> {
  try {
    const user = await requireUser();
    const parsed = contactSchema.partial().parse(input);
    await updateContact(user, id, parsed);
    revalidatePath(`/clients/contacts/${id}`);
    return { ok: true, id };
  } catch (e) {
    return fail(e);
  }
}

export async function revealNationalIdAction(contactId: string): Promise<ActionResult & { value?: string }> {
  try {
    const user = await requireUser();
    const value = await revealNationalId(user, contactId);
    return { ok: true, value };
  } catch (e) {
    return fail(e);
  }
}

export async function setKycStatusAction(params: {
  checklistItemId: string;
  accountId?: string;
  contactId?: string;
  complete: boolean;
  documentId?: string | null;
}): Promise<ActionResult> {
  try {
    const user = await requireUser();
    await setKycStatus(user, params);
    if (params.accountId) revalidatePath(`/clients/accounts/${params.accountId}`);
    if (params.contactId) revalidatePath(`/clients/contacts/${params.contactId}`);
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}
