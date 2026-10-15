"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SESSION_COOKIE } from "@/lib/cookie";
import { bankClient } from "@/lib/env";
import { oktaConfig } from "@/lib/okta";

/** Demo sign-in: the console backend mints the chosen staff member's 8-hour console token. */
export async function signIn(formData: FormData) {
  // With Okta configured, the demo picker is off: staff sign in only through Okta (D-077).
  if (oktaConfig()) redirect("/login");
  const id = formData.get("consoleUserId");
  if (typeof id !== "string" || !id) redirect("/login");
  const session = await bankClient().createConsoleSession(id, "demo");
  (await cookies()).set(SESSION_COOKIE, session.token, {
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production" && process.env.CONSOLE_INSECURE_COOKIE !== "1",
    path: "/",
    expires: new Date(session.expiresAt),
  });
  redirect("/");
}

export async function signOut() {
  (await cookies()).delete(SESSION_COOKIE);
  redirect("/login");
}
