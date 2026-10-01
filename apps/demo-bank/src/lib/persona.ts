import { cookies } from "next/headers";

export const PERSONA_COOKIE = "ddb_persona";
export const DEFAULT_PERSONA = "khalid";

/** Demo-only persona switcher: which synthetic customer is "logged in". */
export async function currentPersonaKey(): Promise<string> {
  const value = (await cookies()).get(PERSONA_COOKIE)?.value;
  return value && /^[a-z]{2,20}$/.test(value) ? value : DEFAULT_PERSONA;
}
