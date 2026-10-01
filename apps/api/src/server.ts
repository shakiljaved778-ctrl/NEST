import { getPrisma } from "@amil/db";
import {
  AnthropicProvider,
  InCountryProvider,
  MockProvider,
  ModelGateway,
  type Provider,
  RedisWordingCache,
} from "@amil/gateway";
import { Redis } from "ioredis";
import { buildApp } from "./app";
import { RedisReplayStore } from "./auth/hmac";
import { loadConfig } from "./config";

const config = loadConfig();
const prisma = getPrisma();
const redis = new Redis(config.REDIS_URL, { lazyConnect: true, maxRetriesPerRequest: 1 });

// Without ANTHROPIC_API_KEY the gateway uses the offline mock provider: the demo works fully offline.
const redactedProvider: Provider = config.ANTHROPIC_API_KEY
  ? new AnthropicProvider({ apiKey: config.ANTHROPIC_API_KEY, model: config.AMIL_ANTHROPIC_MODEL })
  : new MockProvider();
const inCountryProvider = config.IN_COUNTRY_MODEL_URL
  ? new InCountryProvider({
      baseUrl: config.IN_COUNTRY_MODEL_URL,
      model: config.IN_COUNTRY_MODEL,
      ...(config.IN_COUNTRY_API_KEY ? { apiKey: config.IN_COUNTRY_API_KEY } : {}),
    })
  : undefined;

const app = await buildApp({
  logger: {
    level: config.LOG_LEVEL,
    redact: [
      "req.headers.authorization",
      "req.headers.cookie",
      'req.headers["x-amil-signature"]',
      'req.headers["x-amil-key"]',
    ],
    ...(config.NODE_ENV === "development" ? { transport: { target: "pino-pretty" } } : {}),
  },
  widgetOrigins: config.WIDGET_ORIGINS.split(",")
    .map((s) => s.trim())
    .filter(Boolean),
  checks: {
    postgres: async () => {
      await prisma.$queryRaw`SELECT 1`;
    },
    redis: async () => {
      if (redis.status === "wait") await redis.connect();
      await redis.ping();
    },
  },
  v1: {
    prisma,
    apiKeys: config.AMIL_API_KEYS,
    sessionSecret: config.SESSION_SECRET,
    auditHashSecret: config.AUDIT_HASH_SECRET,
    replayStore: new RedisReplayStore(redis),
    clock: () => new Date(),
    gateway: new ModelGateway({
      redactedProvider,
      ...(inCountryProvider ? { inCountryProvider } : {}),
      cache: new RedisWordingCache(redis),
      timeoutMs: config.MODEL_TIMEOUT_MS,
    }),
  },
});
app.log.info(
  {
    provider: redactedProvider.name,
    model: redactedProvider.model,
    inCountry: Boolean(inCountryProvider),
  },
  "model gateway configured",
);

async function shutdown(signal: string): Promise<void> {
  app.log.info({ signal }, "shutting down");
  await app.close();
  await prisma.$disconnect();
  redis.disconnect();
  process.exit(0);
}
process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));

await app.listen({ host: config.API_HOST, port: config.API_PORT });
