import { PrismaClient } from "@prisma/client";

export * from "@prisma/client";

let client: PrismaClient | undefined;

/** Process-wide Prisma client (lazy). */
export function getPrisma(): PrismaClient {
  client ??= new PrismaClient();
  return client;
}

export * from "./audit";
export * from "./adapters";
export { buildSeedData, NAMED_PERSONAS } from "./seed/build";
export { writeSeedData } from "./seed/write";
export { BANK_ID } from "./seed/bank";
