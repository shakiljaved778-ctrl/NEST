"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { encryptField, decryptField, generateTotpSecret, verifyTotp, totpUri } from "@/lib/crypto";
import { logAudit } from "@/lib/audit";
import type { ActionResult } from "@/app/(app)/actions";

function fail(e: unknown): ActionResult {
  return { ok: false, error: e instanceof Error ? e.message : "Something went wrong" };
}

const passwordSchema = z
  .string()
  .min(10, "Password must be at least 10 characters")
  .regex(/[A-Z]/, "Include an uppercase letter")
  .regex(/[a-z]/, "Include a lowercase letter")
  .regex(/[0-9]/, "Include a number");

export async function changePasswordAction(current: string, next: string): Promise<ActionResult> {
  try {
    const user = await requireUser();
    const parsed = passwordSchema.parse(next);
    const dbUser = await db.user.findUniqueOrThrow({ where: { id: user.id } });
    if (!dbUser.passwordHash || !(await bcrypt.compare(current, dbUser.passwordHash))) {
      return { ok: false, error: "Current password is incorrect" };
    }
    await db.user.update({ where: { id: user.id }, data: { passwordHash: await bcrypt.hash(parsed, 10) } });
    await logAudit({ action: "UPDATE", entityType: "USER", entityId: user.id, actorId: user.id, actorEmail: user.email, after: { passwordChanged: true } });
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

/** Begin TOTP enrollment: generate a secret (stored encrypted, not yet enabled). */
export async function beginTotpAction(): Promise<ActionResult & { secret?: string; uri?: string }> {
  try {
    const user = await requireUser();
    const secret = generateTotpSecret();
    await db.user.update({ where: { id: user.id }, data: { totpSecret: encryptField(secret) } });
    return { ok: true, secret, uri: totpUri(secret, user.email ?? "") };
  } catch (e) {
    return fail(e);
  }
}

/** Confirm enrollment by verifying a code against the pending secret. */
export async function confirmTotpAction(code: string): Promise<ActionResult> {
  try {
    const user = await requireUser();
    const dbUser = await db.user.findUniqueOrThrow({ where: { id: user.id } });
    if (!dbUser.totpSecret) return { ok: false, error: "Start enrollment first" };
    const secret = decryptField(dbUser.totpSecret);
    if (!verifyTotp(secret, code)) return { ok: false, error: "Invalid code — try again" };
    await db.user.update({ where: { id: user.id }, data: { totpEnabled: true } });
    await logAudit({ action: "UPDATE", entityType: "USER", entityId: user.id, actorId: user.id, actorEmail: user.email, after: { totpEnabled: true } });
    revalidatePath("/settings");
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function disableTotpAction(): Promise<ActionResult> {
  try {
    const user = await requireUser();
    await db.user.update({ where: { id: user.id }, data: { totpEnabled: false, totpSecret: null } });
    await logAudit({ action: "UPDATE", entityType: "USER", entityId: user.id, actorId: user.id, actorEmail: user.email, after: { totpEnabled: false } });
    revalidatePath("/settings");
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function setEmailDigestAction(enabled: boolean): Promise<ActionResult> {
  try {
    const user = await requireUser();
    await db.user.update({ where: { id: user.id }, data: { emailDigest: enabled } });
    revalidatePath("/settings");
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}
