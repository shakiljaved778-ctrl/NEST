import { PrismaClient } from "@prisma/client";

export * from "@prisma/client";

let client: PrismaClient | undefined;

/** Process-wide Prisma client (lazy). */
export function getPrisma(): PrismaClient {
  client ??= new PrismaClient();
  return client;
}
