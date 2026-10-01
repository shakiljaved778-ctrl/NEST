import { type PrismaClient } from "@amil/db";
import { Queue, Worker } from "bullmq";
import type { Redis } from "ioredis";
import type { CheckDeps } from "./services/checks";
import { PROACTIVE_PACKS, type ProactivePack, runProactive } from "./services/proactive";

export const PROACTIVE_QUEUE = "amil-proactive";
/** Schedules are written in the bank's local time (Doha). */
export const SCHEDULE_TZ = "Asia/Qatar";

export interface ProactiveJobData {
  bankId: string;
  packKey: ProactivePack;
}

const isProactivePack = (key: string): key is ProactivePack =>
  (PROACTIVE_PACKS as readonly string[]).includes(key);

/** `prefix` namespaces the Redis keys (tests use their own). */
export function proactiveQueue(connection: Redis, prefix?: string): Queue<ProactiveJobData> {
  return new Queue<ProactiveJobData>(PROACTIVE_QUEUE, {
    connection,
    ...(prefix ? { prefix } : {}),
    defaultJobOptions: {
      removeOnComplete: 100,
      removeOnFail: 500,
      attempts: 3,
      backoff: { type: "exponential", delay: 30_000 },
    },
  });
}

/**
 * Mirror the ProactiveJob rows (bank-managed, console-editable) into BullMQ repeatable job
 * schedulers: enabled rows get a cron scheduler, disabled or unknown ones are removed. Idempotent;
 * the worker calls it at start and periodically so console changes take effect.
 */
export async function syncSchedules(
  prisma: PrismaClient,
  queue: Queue<ProactiveJobData>,
): Promise<{ scheduled: string[]; removed: string[] }> {
  const rows = await prisma.proactiveJob.findMany({
    orderBy: [{ bankId: "asc" }, { rulePackKey: "asc" }],
  });
  const scheduled: string[] = [];
  const removed: string[] = [];
  const wanted = new Set<string>();
  for (const row of rows) {
    const id = `${row.bankId}:${row.rulePackKey}`;
    if (!row.enabled || !isProactivePack(row.rulePackKey)) continue;
    wanted.add(id);
    await queue.upsertJobScheduler(
      id,
      { pattern: row.schedule, tz: SCHEDULE_TZ },
      { name: "proactive", data: { bankId: row.bankId, packKey: row.rulePackKey } },
    );
    scheduled.push(id);
  }
  for (const s of await queue.getJobSchedulers()) {
    if (s.key && !wanted.has(s.key)) {
      await queue.removeJobScheduler(s.key);
      removed.push(s.key);
    }
  }
  return { scheduled, removed };
}

/** The worker that runs proactive packs, one job at a time. */
export function proactiveWorker(
  connection: Redis,
  deps: CheckDeps,
  prefix?: string,
): Worker<ProactiveJobData> {
  return new Worker<ProactiveJobData>(
    PROACTIVE_QUEUE,
    async (job) => runProactive(deps, job.data.bankId, job.data.packKey),
    { connection, concurrency: 1, ...(prefix ? { prefix } : {}) },
  );
}
