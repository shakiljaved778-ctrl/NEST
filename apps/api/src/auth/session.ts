import { type Locale, type Scope, Scope as ScopeSchema } from "@amil/sdk";
import { jwtVerify, SignJWT } from "jose";
import { z } from "zod";

/** Widget session tokens (section 7): minted by the bank backend, 15-minute TTL. */
export const SESSION_TTL_SECONDS = 15 * 60;
const ISSUER = "amil";
const AUDIENCE = "amil-widget";

export interface SessionClaims {
  bankId: string;
  customerRef: string;
  scopes: Scope[];
  locale?: Locale;
}

const ClaimsSchema = z.object({
  sub: z.string().min(1),
  bank: z.string().min(1),
  scopes: z.array(ScopeSchema),
  locale: z.enum(["en", "ar"]).optional(),
});

const key = (secret: string) => new TextEncoder().encode(secret);

export async function mintSessionToken(
  secret: string,
  claims: SessionClaims,
  nowSeconds: number,
): Promise<{ token: string; expiresAt: Date }> {
  const exp = nowSeconds + SESSION_TTL_SECONDS;
  const token = await new SignJWT({
    bank: claims.bankId,
    scopes: claims.scopes,
    ...(claims.locale ? { locale: claims.locale } : {}),
  })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setSubject(claims.customerRef)
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setIssuedAt(nowSeconds)
    .setExpirationTime(exp)
    .sign(key(secret));
  return { token, expiresAt: new Date(exp * 1000) };
}

export async function verifySessionToken(
  secret: string,
  token: string,
  nowSeconds: number,
): Promise<SessionClaims | null> {
  try {
    const { payload } = await jwtVerify(token, key(secret), {
      issuer: ISSUER,
      audience: AUDIENCE,
      algorithms: ["HS256"],
      currentDate: new Date(nowSeconds * 1000),
    });
    const c = ClaimsSchema.parse(payload);
    return {
      bankId: c.bank,
      customerRef: c.sub,
      scopes: c.scopes,
      ...(c.locale ? { locale: c.locale } : {}),
    };
  } catch {
    return null;
  }
}
