"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { dealSchema, subscriptionSchema } from "@/lib/validation";
import { createDeal, updateDeal, moveDealStage, createSubscriptionsForDeal } from "@/lib/services/deals";
import type { ActionResult } from "@/app/(app)/actions";

function fail(e: unknown): ActionResult {
  return { ok: false, error: e instanceof Error ? e.message : "Something went wrong" };
}

export async function createDealAction(input: unknown): Promise<ActionResult> {
  try {
    const user = await requireUser();
    const parsed = dealSchema.parse(input);
    const deal = await createDeal(user, parsed);
    revalidatePath("/deals");
    return { ok: true, id: deal.id };
  } catch (e) {
    return fail(e);
  }
}

export async function updateDealAction(id: string, input: unknown): Promise<ActionResult> {
  try {
    const user = await requireUser();
    const parsed = dealSchema.partial().parse(input);
    await updateDeal(user, id, parsed);
    revalidatePath(`/deals/${id}`);
    revalidatePath("/deals");
    return { ok: true, id };
  } catch (e) {
    return fail(e);
  }
}

export async function moveDealStageAction(
  dealId: string,
  toStageId: string,
  opts: { lossReason?: string; winReason?: string } = {}
): Promise<ActionResult & { closedWon?: boolean }> {
  try {
    const user = await requireUser();
    const deal = await moveDealStage(user, dealId, toStageId, opts);
    revalidatePath("/deals");
    revalidatePath(`/deals/${dealId}`);
    return { ok: true, id: dealId, closedWon: deal.status === "WON" };
  } catch (e) {
    return fail(e);
  }
}

const subsInputSchema = z.array(
  subscriptionSchema.pick({ productId: true, startDate: true, renewalDate: true, mrrValue: true })
);

export async function createSubscriptionsAction(dealId: string, items: unknown): Promise<ActionResult> {
  try {
    const user = await requireUser();
    const parsed = subsInputSchema.parse(items);
    await createSubscriptionsForDeal(
      user,
      dealId,
      parsed.map((p) => ({ ...p, renewalDate: p.renewalDate ?? null }))
    );
    revalidatePath(`/deals/${dealId}`);
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}
