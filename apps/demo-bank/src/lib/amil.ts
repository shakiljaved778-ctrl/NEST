import "server-only";
import { AmilServerClient } from "@amil/sdk/server";
import { z } from "zod";

const Env = z.object({
  AMIL_API_URL: z.string().url().default("http://localhost:4000"),
  AMIL_DEMO_KEY_ID: z.string().min(3),
  AMIL_DEMO_KEY_SECRET: z.string().min(32),
});

/**
 * The bank backend's AMIL client. The HMAC secret stays on the server; the browser only ever gets
 * a 15-minute session token for the logged-in customer.
 */
export function amilServer(): AmilServerClient {
  const env = Env.parse(process.env);
  return new AmilServerClient({
    baseUrl: env.AMIL_API_URL,
    keyId: env.AMIL_DEMO_KEY_ID,
    secret: env.AMIL_DEMO_KEY_SECRET,
  });
}

/** Mint a widget session token. Returns null if AMIL is unreachable, so the bank flow continues. */
export async function mintWidgetToken(
  customerRef: string,
  locale: "en" | "ar",
): Promise<string | null> {
  try {
    const session = await amilServer().createSession({ customerRef, locale });
    return session.token;
  } catch (error) {
    console.error("AMIL session unavailable", error instanceof Error ? error.message : error);
    return null;
  }
}

/** Browser-facing AMIL base URL (the widget calls the API directly with the session token). */
export function publicAmilUrl(): string {
  return process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
}
