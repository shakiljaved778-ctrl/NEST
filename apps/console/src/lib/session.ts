import "server-only";
import { redirect } from "next/navigation";
import { cache } from "react";
import { adminGet, ApiError } from "./api";
import type { Me } from "./types";

/** The signed-in staff member, re-checked with AMIL on every request (roles can change). */
export const requireUser = cache(async (): Promise<Me> => {
  try {
    return await adminGet<Me>("/me");
  } catch (error) {
    if (error instanceof ApiError && (error.status === 401 || error.status === 403))
      redirect("/login");
    throw error;
  }
});

export function can(me: Me, permission: string): boolean {
  return me.permissions.includes(permission);
}

/** Pages a role cannot use are not linked; opening one directly shows the forbidden state. */
export async function requirePermission(permission: string): Promise<Me> {
  const me = await requireUser();
  if (!can(me, permission)) redirect("/forbidden");
  return me;
}
