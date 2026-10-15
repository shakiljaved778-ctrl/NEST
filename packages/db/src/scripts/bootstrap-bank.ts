/**
 * `pnpm db:bootstrap <config.json>`: set up a real bank's tenant (D-080). See
 * docs/DEPLOYMENT.md and infra/bank-config.example.json.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { PrismaClient } from "@prisma/client";
import { z } from "zod";
import { applyBootstrap, BankConfigSchema, planBootstrap } from "../bootstrap";

const path = process.argv.slice(2).find((a) => a !== "--");
if (!path) {
  console.error("usage: pnpm db:bootstrap <bank-config.json>");
  process.exit(2);
}
// Relative to where the command was run (pnpm runs the script inside packages/db).
const file = resolve(process.env.INIT_CWD ?? process.cwd(), path);
const parsed = BankConfigSchema.safeParse(JSON.parse(readFileSync(file, "utf8")));
if (!parsed.success) {
  console.error(`Invalid bank config ${path}:\n${z.prettifyError(parsed.error)}`);
  process.exit(2);
}

const prisma = new PrismaClient();
try {
  const plan = planBootstrap(parsed.data, new Date());
  const added = await applyBootstrap(prisma, plan);
  console.log(
    [
      `Bootstrapped ${plan.bank.id} (${plan.bank.name}). Added:`,
      `  console users ${added.consoleUsers}, rule packs ${added.rulePacks} (switched off),`,
      `  templates ${added.templates} (in review), proactive jobs ${added.proactiveJobs},`,
      `  fees ${added.feeSchedule}`,
      "Next, in the console: product proposes the bank's terms for each pack, compliance",
      "approves them and the copy, then compliance switches each pack on.",
    ].join("\n"),
  );
} finally {
  await prisma.$disconnect();
}
