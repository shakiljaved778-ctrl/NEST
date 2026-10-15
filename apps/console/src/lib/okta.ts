import "server-only";
import { type Discovery, discover, type OidcConfig, oidcConfigFromEnv } from "./oidc";

/** The console's Okta settings, or null in demo mode (staff picker). */
export const oktaConfig = (): OidcConfig | null => oidcConfigFromEnv(process.env);

let cached: { issuer: string; doc: Promise<Discovery> } | undefined;
/** Okta's discovery document, fetched once per process. */
export function oktaDiscovery(cfg: OidcConfig): Promise<Discovery> {
  if (cached?.issuer !== cfg.issuer) {
    const doc = discover(cfg).catch((e: unknown) => {
      cached = undefined;
      throw e;
    });
    cached = { issuer: cfg.issuer, doc };
  }
  return cached.doc;
}

/** Short-lived cookie holding one sign-in attempt's state, nonce and PKCE verifier. */
export const ATTEMPT_COOKIE = "amil_oidc_attempt";
