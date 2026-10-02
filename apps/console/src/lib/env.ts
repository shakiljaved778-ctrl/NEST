import "server-only";
import { AmilServerClient } from "@amil/sdk/server";
import { z } from "zod";

const Env = z.object({
  AMIL_API_URL: z.string().url().default("http://localhost:4000"),
  AMIL_DEMO_KEY_ID: z.string().min(3),
  AMIL_DEMO_KEY_SECRET: z.string().min(32),
});

/** AMIL API base URL, as seen from the console's server. */
export const apiUrl = () => Env.parse(process.env).AMIL_API_URL.replace(/\/$/, "");

/**
 * The console backend's HMAC client: used only to list staff and mint their console tokens.
 * In the demo it shares the bank's server key; the secret never reaches the browser.
 */
export function bankClient(): AmilServerClient {
  const env = Env.parse(process.env);
  return new AmilServerClient({
    baseUrl: env.AMIL_API_URL,
    keyId: env.AMIL_DEMO_KEY_ID,
    secret: env.AMIL_DEMO_KEY_SECRET,
  });
}
