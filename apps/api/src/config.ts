import { z } from "zod";

const ApiKeysSchema = z
  .string()
  .transform((raw) =>
    raw
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
      .map((entry) => {
        const [keyId, secret, bankId, purpose] = entry.split(":");
        return {
          keyId: keyId ?? "",
          secret: secret ?? "",
          bankId: bankId ?? "",
          purpose: (purpose ?? "bank") as "bank" | "console",
        };
      }),
  )
  .pipe(
    z
      .array(
        z.object({
          keyId: z.string().min(3),
          secret: z.string().min(32),
          bankId: z.string().min(1),
          /** bank: the bank app's backend; console: only signs staff into the console (D-067). */
          purpose: z.enum(["bank", "console"]),
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
  /** keyId:secret:bankId[:purpose][,...]. Bank-to-AMIL HMAC credentials; purpose bank|console. */
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
  /** Requests per minute (D-064): per bank key, widget session, console user, anonymous IP. */
  RATE_LIMIT_SERVER_PER_MIN: z.coerce.number().int().min(1).default(6000),
  RATE_LIMIT_SESSION_PER_MIN: z.coerce.number().int().min(1).default(120),
  RATE_LIMIT_CONSOLE_PER_MIN: z.coerce.number().int().min(1).default(600),
  RATE_LIMIT_ANONYMOUS_PER_MIN: z.coerce.number().int().min(1).default(300),
  RATE_LIMIT_ASSISTANT_PER_MIN: z.coerce.number().int().min(1).default(20),
});

export type Config = z.infer<typeof EnvSchema>;
/** A configured key; `purpose` defaults to "bank" (D-067). */
export type ApiKey = Omit<Config["AMIL_API_KEYS"][number], "purpose"> & {
  purpose?: "bank" | "console";
};

/** Parse and validate the environment once at startup; fail fast on bad config. */
export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const parsed = EnvSchema.safeParse(env);
  if (!parsed.success) {
    throw new Error(`Invalid environment:\n${z.prettifyError(parsed.error)}`);
  }
  return parsed.data;
}
