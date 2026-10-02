import { getPrisma } from "@amil/db";
import { Redis } from "ioredis";
import { buildApp } from "./app";
import { RedisReplayStore } from "./auth/hmac";
import { loadConfig } from "./config";
import { buildModelGateway } from "./model-gateway";
import { startTelemetry } from "./telemetry";

const config = loadConfig();
// Before anything else, so spans cover start-up too. A no-op without an OTLP endpoint (D-070).
const telemetry = await startTelemetry(process.env, "amil-api");
const prisma = getPrisma();
const redis = new Redis(config.REDIS_URL, { lazyConnect: true, maxRetriesPerRequest: 1 });

const { gateway, redactedProvider, inCountry } = buildModelGateway(config, redis);

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
  rateLimit: {
    redis,
    serverPerMinute: config.RATE_LIMIT_SERVER_PER_MIN,
    sessionPerMinute: config.RATE_LIMIT_SESSION_PER_MIN,
    consolePerMinute: config.RATE_LIMIT_CONSOLE_PER_MIN,
    anonymousPerMinute: config.RATE_LIMIT_ANONYMOUS_PER_MIN,
    assistantPerMinute: config.RATE_LIMIT_ASSISTANT_PER_MIN,
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
    gateway,
  },
});
app.log.info(
  {
    provider: redactedProvider.name,
    model: redactedProvider.model,
    inCountry,
  },
  "model gateway configured",
);

async function shutdown(signal: string): Promise<void> {
  app.log.info({ signal }, "shutting down");
  await app.close();
  await prisma.$disconnect();
  redis.disconnect();
  await telemetry?.shutdown();
  process.exit(0);
}
process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));

await app.listen({ host: config.API_HOST, port: config.API_PORT });
