"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { LOCALE_COOKIE } from "@/i18n/request";
import { amilServer } from "@/lib/amil";
import { currentCustomer } from "@/lib/bank";
import { PERSONA_COOKIE } from "@/lib/persona";

const YEAR = 60 * 60 * 24 * 365;

export async function setLocale(locale: "en" | "ar", returnTo: string): Promise<void> {
  (await cookies()).set(LOCALE_COOKIE, locale === "ar" ? "ar" : "en", {
    path: "/",
    maxAge: YEAR,
    sameSite: "lax",
  });
  redirect(returnTo.startsWith("/") ? returnTo : "/");
}

export async function setPersona(formData: FormData): Promise<void> {
  const raw = formData.get("persona");
  const key = typeof raw === "string" ? raw : "";
  if (!/^[a-z]{2,20}$/.test(key)) return;
  (await cookies()).set(PERSONA_COOKIE, key, { path: "/", maxAge: YEAR, sameSite: "lax" });
  redirect("/");
}

/** The bank records consent with AMIL from its own backend (non-negotiable 5). */
export async function setInsightsConsent(formData: FormData): Promise<void> {
  const customer = await currentCustomer();
  const amil = amilServer();
  if (formData.get("grant") === "1") {
    await amil.grantConsent({
      customerRef: customer.externalRef,
      purpose: "pre_decision_insights",
      version: "1.0",
      method: "in_app",
      privacyPolicyVersion: "2026-01",
    });
  } else {
    await amil.withdrawConsent(customer.externalRef, "pre_decision_insights");
  }
  revalidatePath("/settings");
}
