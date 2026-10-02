import { jwtVerify, SignJWT } from "jose";
import { z } from "zod";
import { CONSOLE_ROLES, type ConsoleRole } from "./rbac";

/**
 * Console session tokens: minted by the bank's console backend over HMAC for a signed-in staff
 * member. A different audience from widget sessions, so neither token works for the other.
 */
export const CONSOLE_SESSION_TTL_SECONDS = 8 * 60 * 60;
const ISSUER = "amil";
const AUDIENCE = "amil-console";

export interface ConsoleClaims {
  bankId: string;
  userId: string;
  role: ConsoleRole;
}

const Claims = z.object({
  sub: z.string().min(1),
  bank: z.string().min(1),
  role: z.enum(CONSOLE_ROLES),
});
const key = (secret: string) => new TextEncoder().encode(`${secret}:console`);

export async function mintConsoleToken(
  secret: string,
  claims: ConsoleClaims,
  nowSeconds: number,
): Promise<{ token: string; expiresAt: Date }> {
  const exp = nowSeconds + CONSOLE_SESSION_TTL_SECONDS;
  const token = await new SignJWT({ bank: claims.bankId, role: claims.role })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setSubject(claims.userId)
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setIssuedAt(nowSeconds)
    .setExpirationTime(exp)
    .sign(key(secret));
  return { token, expiresAt: new Date(exp * 1000) };
}

export async function verifyConsoleToken(
  secret: string,
  token: string,
  nowSeconds: number,
): Promise<ConsoleClaims | null> {
  try {
    const { payload } = await jwtVerify(token, key(secret), {
      issuer: ISSUER,
      audience: AUDIENCE,
      algorithms: ["HS256"],
      currentDate: new Date(nowSeconds * 1000),
    });
    const c = Claims.parse(payload);
    return { bankId: c.bank, userId: c.sub, role: c.role };
  } catch {
    return null;
  }
}
