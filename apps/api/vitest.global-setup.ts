import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";

/** Seed instant used by the integration tests (they inject the same clock). */
export const TEST_SEED_NOW = "2026-09-30T09:00:00.000Z";

/** Migrate and seed the integration-test database, if one is configured. */
export default async function setup(): Promise<void> {
  const url = process.env.TEST_DATABASE_URL;
  if (!url) return;
  const dbDir = fileURLToPath(new URL("../../packages/db", import.meta.url));
  execSync("pnpm exec prisma migrate deploy", {
    cwd: dbDir,
    stdio: "ignore",
    env: { ...process.env, DATABASE_URL: url },
  });
  const { PrismaClient, buildSeedData, writeSeedData } = await import("@amil/db");
  const prisma = new PrismaClient({ datasources: { db: { url } } });
  try {
    await writeSeedData(prisma, buildSeedData(new Date(TEST_SEED_NOW)));
  } finally {
    await prisma.$disconnect();
  }
}
