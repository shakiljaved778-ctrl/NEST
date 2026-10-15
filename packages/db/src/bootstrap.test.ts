/**
 * The bank bootstrap (D-080): config validation, the plan, and (against TEST_DATABASE_URL) that
 * applying it twice adds nothing and never overrides the bank's own work.
 */
import { readFileSync } from "node:fs";
import { PrismaClient } from "@prisma/client";
import { afterAll, describe, expect, it } from "vitest";
import { applyBootstrap, BankConfigSchema, consoleUserId, planBootstrap } from "./bootstrap";

const example = JSON.parse(
  readFileSync(new URL("../../../infra/bank-config.example.json", import.meta.url), "utf8"),
) as Record<string, unknown>;
const now = new Date("2026-10-15T08:00:00Z");

describe("bank config", () => {
  it("accepts the example config", () => {
    expect(BankConfigSchema.safeParse(example).success).toBe(true);
  });

  it.each([
    ["an unknown pack", { packs: ["card.closed"] }, "unknown pack card.closed"],
    [
      "a non-proactive schedule",
      { proactiveSchedules: { "card.close": "0 6 * * *" } },
      "not a proactive pack",
    ],
    [
      "no compliance user",
      { consoleUsers: [{ email: "a@b.example", name: "A", role: "admin" }] },
      "compliance",
    ],
    [
      "duplicate emails",
      {
        consoleUsers: [
          { email: "c@b.example", name: "C", role: "compliance" },
          { email: "C@b.example", name: "C2", role: "viewer" },
        ],
      },
      "unique",
    ],
    ["an unknown field", { customers: [] }, "customers"],
  ])("rejects %s", (_name, patch, message) => {
    const result = BankConfigSchema.safeParse({ ...example, ...patch });
    expect(result.success).toBe(false);
    expect(JSON.stringify(result.error?.issues)).toContain(message);
  });

  it("rejects a float amount in a fee", () => {
    const fee = {
      code: "LATE",
      nameEn: "Late fee",
      nameAr: "رسوم التأخير",
      descriptionEn: "d",
      descriptionAr: "d",
      avoidTipEn: "t",
      avoidTipAr: "t",
      amountRule: { type: "fixed", amount: 25 },
    };
    expect(BankConfigSchema.safeParse({ ...example, feeSchedule: [fee] }).success).toBe(false);
  });
});

describe("bootstrap plan", () => {
  const plan = planBootstrap(BankConfigSchema.parse(example), now);

  it("installs the chosen packs switched off, in both variants", () => {
    expect(new Set(plan.rulePacks.map((p) => p.key))).toEqual(
      new Set(["card.close", "finance.early_settlement", "deposit.break", "rewards.expiry"]),
    );
    expect(plan.rulePacks.every((p) => p.enabled === false && p.status === "active")).toBe(true);
    expect(new Set(plan.rulePacks.map((p) => p.variant))).toEqual(
      new Set(["conventional", "islamic"]),
    );
  });

  it("imports copy for review only, never as approved", () => {
    expect(plan.templates.length).toBeGreaterThan(0);
    expect(plan.templates.every((t) => t.status === "in_review" && !t.approvedBy)).toBe(true);
    expect(plan.templates.some((t) => t.rulePackKey === "card.minimum_payment")).toBe(false);
    expect(plan.templates.some((t) => t.rulePackKey === "card.close")).toBe(true);
  });

  it("writes no customer data and schedules only installed proactive packs", () => {
    expect(Object.keys(plan).sort()).toEqual(
      ["bank", "consoleUsers", "feeSchedule", "proactiveJobs", "rulePacks", "templates"].sort(),
    );
    expect(plan.proactiveJobs).toEqual([
      { bankId: "bank_example", rulePackKey: "rewards.expiry", schedule: "15 6 * * *" },
    ]);
  });

  it("gives console users stable ids from their email", () => {
    expect(plan.consoleUsers[0]?.id).toBe(consoleUserId("bank_example", "AMIL.admin@bank.example"));
    expect(plan.consoleUsers.map((u) => u.email)).toContain("compliance@bank.example");
  });

  it("drops the Islamic packs and copy for a conventional-only bank", () => {
    const conv = planBootstrap(
      BankConfigSchema.parse({ ...example, variants: ["conventional"] }),
      now,
    );
    expect(conv.rulePacks.every((p) => p.variant === "conventional")).toBe(true);
    expect(conv.templates.every((t) => t.variant === "conventional")).toBe(true);
  });
});

const url = process.env.TEST_DATABASE_URL;

describe.skipIf(!url)("bootstrap against a database", () => {
  const prisma = new PrismaClient({ datasources: { db: { url: url ?? "" } } });
  const bankId = "bank_bootstrap_test";
  const config = BankConfigSchema.parse({
    ...example,
    bank: { ...(example.bank as object), id: bankId },
  });
  afterAll(async () => {
    await prisma.bank.deleteMany({ where: { id: bankId } });
    await prisma.$disconnect();
  });

  it("adds only what is missing and keeps the bank's own changes", async () => {
    await prisma.bank.deleteMany({ where: { id: bankId } });
    const plan = planBootstrap(config, now);
    const first = await applyBootstrap(prisma, plan);
    expect(first).toEqual({
      consoleUsers: 4,
      rulePacks: plan.rulePacks.length,
      templates: plan.templates.length,
      proactiveJobs: 1,
      feeSchedule: 0,
    });

    // The bank works on it: compliance switches a pack on, approves a template, an admin
    // changes a role.
    const pack = await prisma.rulePack.findFirstOrThrow({ where: { bankId, key: "card.close" } });
    await prisma.rulePack.update({ where: { id: pack.id }, data: { enabled: true } });
    const tpl = await prisma.template.findFirstOrThrow({ where: { bankId } });
    await prisma.template.update({ where: { id: tpl.id }, data: { status: "approved" } });
    const admin = plan.consoleUsers[0]!;
    await prisma.consoleUser.update({ where: { id: admin.id }, data: { role: "viewer" } });

    const second = await applyBootstrap(prisma, planBootstrap(config, new Date()));
    expect(second).toEqual({
      consoleUsers: 0,
      rulePacks: 0,
      templates: 0,
      proactiveJobs: 0,
      feeSchedule: 0,
    });
    expect((await prisma.rulePack.findUniqueOrThrow({ where: { id: pack.id } })).enabled).toBe(
      true,
    );
    expect((await prisma.template.findUniqueOrThrow({ where: { id: tpl.id } })).status).toBe(
      "approved",
    );
    expect((await prisma.consoleUser.findUniqueOrThrow({ where: { id: admin.id } })).role).toBe(
      "viewer",
    );
    expect(await prisma.customer.count({ where: { bankId } })).toBe(0);
  });
});
