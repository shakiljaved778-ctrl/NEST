import { PrismaClient } from "@prisma/client";

export * from "@prisma/client";

const globalForPrisma = globalThis as unknown as { amilPrisma?: PrismaClient };

/** Process-wide Prisma client (survives Next.js dev hot reloads). */
export function getPrisma(): PrismaClient {
  globalForPrisma.amilPrisma ??= new PrismaClient();
  return globalForPrisma.amilPrisma;
}
