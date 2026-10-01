import { z } from "zod";

const ApiKeysSchema = z
  .string()
  .transform((raw) =>
    raw
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
      .map((entry) => {
        const [keyId, secret, bankId] = entry.split(":");
        return { keyId: keyId ?? "", secret: secret ?? "", bankId: bankId ?? "" };
      }),
  )
  .pipe(
    z
      .array(
        z.object({
          keyId: z.string().min(3),
          secret: z.string().min(32),
          bankId: z.string().min(1),
        }),
      )
      .min(1),
  );

const EnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  API_HOST: z.string().default("0.0.0.0"),
  API_PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"]).default("info"),
  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url().default("redis://localhost:6379"),
  /** keyId:secret:bankId[,keyId:secret:bankId...]. Bank-to-AMIL HMAC credentials. */
  AMIL_API_KEYS: ApiKeysSchema,
  /** Signs widget session tokens (HS256). */
  SESSION_SECRET: z.string().min(32),
  /** Keys the customer-ref hash stored in the audit trail. */
  AUDIT_HASH_SECRET: z.string().min(32),
  /** Browser origins allowed to call widget endpoints. */
  WIDGET_ORIGINS: z.string().default("http://localhost:3000"),
  ANTHROPIC_API_KEY: z.string().optional(),
  AMIL_ANTHROPIC_MODEL: z.string().default("claude-opus-5-5"),
  IN_COUNTRY_MODEL_URL: z.string().url().optional(),
  IN_COUNTRY_MODEL: z.string().default("in-country-model"),
  IN_COUNTRY_API_KEY: z.string().optional(),
  MODEL_TIMEOUT_MS: z.coerce.number().int().min(100).max(10_000).default(1500),
});

export type Config = z.infer<typeof EnvSchema>;
export type ApiKey = Config["AMIL_API_KEYS"][number];

/** Parse and validate the environment once at startup; fail fast on bad config. */
export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const parsed = EnvSchema.safeParse(env);
  if (!parsed.success) {
    throw new Error(`Invalid environment:\n${z.prettifyError(parsed.error)}`);
  }
  return parsed.data;
}
