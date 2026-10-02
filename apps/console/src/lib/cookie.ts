import "server-only";
import { cookies } from "next/headers";

/** The console token lives only in this httpOnly, same-site cookie: the browser cannot read it. */
export const SESSION_COOKIE = "amil_console";

export async function sessionToken(): Promise<string | null> {
  return (await cookies()).get(SESSION_COOKIE)?.value ?? null;
}
