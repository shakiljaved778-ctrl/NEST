/**
 * AMIL proactive worker: runs scheduled packs (rewards.expiry, account.dormancy) through BullMQ
 * and writes audited alerts. Start with `pnpm --filter @amil/api worker`.
 */
import { getPrisma } from "@amil/db";
import { Redis } from "ioredis";
import pino from "pino";
import { loadConfig } from "./config";
import { buildModelGateway } from "./model-gateway";
import { proactiveQueue, proactiveWorker, syncSchedules } from "./scheduler";
import { startTelemetry } from "./telemetry";

const config = loadConfig();
await startTelemetry(process.env, "amil-worker");
const log = pino({ level: config.LOG_LEVEL, name: "amil-worker" });
const prisma = getPrisma();
// BullMQ needs blocking commands: no per-request retry limit on its connection.
const connection = new Redis(config.REDIS_URL, { maxRetriesPerRequest: null });
const cacheRedis = new Redis(config.REDIS_URL, { maxRetriesPerRequest: 1 });
const { gateway } = buildModelGateway(config, cacheRedis);

const queue = proactiveQueue(connection);
const worker = proactiveWorker(connection, {
  prisma,
  gateway,
  auditHashSecret: config.AUDIT_HASH_SECRET,
  clock: () => new Date(),
  log,
});
worker.on("completed", (job, result) =>
  log.info({ job: job.id, result }, "proactive job completed"),
);
worker.on("failed", (job, error) =>
  log.error({ job: job?.id, error: error.message }, "proactive job failed"),
);

const sync = async () => log.info(await syncSchedules(prisma, queue), "schedules synced");
await sync();
const timer = setInterval(
  () => void sync().catch((e: unknown) => log.error({ e }, "sync failed")),
  5 * 60_000,
);

async function shutdown(signal: string): Promise<void> {
  log.info({ signal }, "worker shutting down");
  clearInterval(timer);
  await worker.close();
  await queue.close();
  await gateway.drain();
  await prisma.$disconnect();
  connection.disconnect();
  cacheRedis.disconnect();
  process.exit(0);
}
process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));
