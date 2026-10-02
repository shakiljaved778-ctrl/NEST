import type { PrismaClient } from "@amil/db";
import type { FastifyRequest } from "fastify";
import { forbidden, unauthorized } from "../errors";
import { can, type ConsoleRole, type Permission } from "./rbac";
import { verifyConsoleToken } from "./session";

export interface ConsoleUser {
  bankId: string;
  id: string;
  name: string;
  email: string;
  role: ConsoleRole;
}

/**
 * Authenticate a console request (Bearer console token) and check the permission. The user is
 * re-read on every request, so deactivating a user or changing their role takes effect at once.
 */
export async function authenticateConsole(
  req: FastifyRequest,
  deps: { prisma: PrismaClient; sessionSecret: string; clock: () => Date },
  permission: Permission,
): Promise<ConsoleUser> {
  const authz = req.headers.authorization;
  if (!authz?.startsWith("Bearer ")) throw unauthorized();
  const claims = await verifyConsoleToken(
    deps.sessionSecret,
    authz.slice(7),
    Math.floor(deps.clock().getTime() / 1000),
  );
  if (!claims) throw unauthorized();
  const user = await deps.prisma.consoleUser.findFirst({
    where: { id: claims.userId, bankId: claims.bankId, active: true },
  });
  if (!user) throw unauthorized();
  const role = user.role;
  if (!can(role, permission)) throw forbidden();
  return { bankId: user.bankId, id: user.id, name: user.name, email: user.email, role };
}
