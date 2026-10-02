"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SESSION_COOKIE } from "@/lib/cookie";
import { bankClient } from "@/lib/env";

/** Demo sign-in: the console backend mints the chosen staff member's 8-hour console token. */
export async function signIn(formData: FormData) {
  const id = formData.get("consoleUserId");
  if (typeof id !== "string" || !id) redirect("/login");
  const session = await bankClient().createConsoleSession(id);
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
