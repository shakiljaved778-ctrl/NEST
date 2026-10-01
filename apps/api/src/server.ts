import { getPrisma } from "@amil/db";
import { Redis } from "ioredis";
import { buildApp } from "./app";
import { RedisReplayStore } from "./auth/hmac";
import { loadConfig } from "./config";
import { buildModelGateway } from "./model-gateway";

const config = loadConfig();
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
  process.exit(0);
}
process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));

await app.listen({ host: config.API_HOST, port: config.API_PORT });
