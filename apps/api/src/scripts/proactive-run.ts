/**
 * Run proactive packs now, without waiting for the schedule (demo and operations):
 *   pnpm proactive:run                    # every enabled proactive pack, every bank, in-process
 *   pnpm proactive:run rewards.expiry     # one pack
 *   pnpm proactive:run --queue            # enqueue through BullMQ instead (needs the worker)
 */
import { getPrisma } from "@amil/db";
import { Redis } from "ioredis";
import pino from "pino";
import { loadConfig } from "../config";
import { buildModelGateway } from "../model-gateway";
import { proactiveQueue } from "../scheduler";
import { PROACTIVE_PACKS, type ProactivePack, runProactive } from "../services/proactive";

const config = loadConfig();
const log = pino({ level: "warn" });
const args = process.argv.slice(2);
const viaQueue = args.includes("--queue");
const packs = PROACTIVE_PACKS.filter((p) => args.includes(p));
const selected: readonly ProactivePack[] = packs.length ? packs : PROACTIVE_PACKS;

const prisma = getPrisma();
const redis = new Redis(config.REDIS_URL, { maxRetriesPerRequest: viaQueue ? null : 1 });
const banks = await prisma.bank.findMany({ select: { id: true } });

if (viaQueue) {
  const queue = proactiveQueue(redis);
  for (const bank of banks)
    for (const packKey of selected) {
      const job = await queue.add("proactive", { bankId: bank.id, packKey });
      console.log(`enqueued ${packKey} for ${bank.id} (job ${job.id})`);
    }
  await queue.close();
} else {
  const { gateway } = buildModelGateway(config, redis);
  const deps = {
    prisma,
    gateway,
    auditHashSecret: config.AUDIT_HASH_SECRET,
    clock: () => new Date(),
    log,
  };
  for (const bank of banks)
    for (const packKey of selected) {
      const r = await runProactive(deps, bank.id, packKey);
      console.log(
        `${bank.id} ${packKey}: ${r.status}, ${r.customers} customers, ${r.evaluated} products, ` +
          `${r.alertsCreated} new alerts, ${r.alreadyAlerted} already alerted`,
      );
    }
  await gateway.drain();
}
await prisma.$disconnect();
redis.disconnect();
