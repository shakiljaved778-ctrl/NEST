/**
 * Bootstrap a real bank's tenant (D-080): the bank record, its console staff, the rule packs
 * and the shipped copy, with no customer data. Customer and product data arrive later through
 * the bank's data feed, never through this script.
 *
 * Safe by default:
 * - packs start **switched off** (kill switch, non-negotiable 9); compliance turns each one on in
 *   the console (D-075), after product has proposed the bank's own terms and compliance has
 *   approved them (D-074);
 * - copy is imported as `in_review`, so nothing reaches a customer until compliance (and Sharia,
 *   for Islamic copy) approves it in the console (non-negotiable 8);
 * - re-running adds only what is missing. It never changes a pack, a template or a fee the bank
 *   has already worked on, and never touches the audit tables.
 */
import { createHash } from "node:crypto";
import type { Prisma, PrismaClient } from "@prisma/client";
import { ALL_PACK_DEFINITIONS, ALL_TEMPLATES, PROACTIVE_RULE_PACK_KEYS } from "@amil/rule-packs";
import { z } from "zod";

const Locale = z.enum(["en", "ar"]);
const Variant = z.enum(["conventional", "islamic"]);
const Money = z.string().regex(/^\d+(\.\d{1,2})?$/, "a decimal string, e.g. 250.00");
const Threshold = z.object({ cautionAtQar: Money, criticalAtQar: Money }).strict();
const Cron = z.string().regex(/^(\S+\s+){4}\S+$/, "a 5-field cron expression");

export const BankConfigSchema = z
  .object({
    bank: z
      .object({
        id: z.string().regex(/^bank_[a-z0-9_]{2,40}$/, "bank_<lowercase id>"),
        name: z.string().min(2),
        nameAr: z.string().min(2),
        defaultLocale: Locale,
        supportedLocales: z.array(Locale).min(1),
        brandTokens: z.record(z.string(), z.string()),
        deepLinkScheme: z.string().regex(/^[a-z][a-z0-9+.-]*:\/\//, "e.g. mybank://"),
        digitStyle: z.enum(["latn", "arab"]).default("latn"),
        severityThresholds: z.record(z.string(), Threshold).refine((t) => "default" in t, {
          message: "needs a default threshold",
        }),
        modelMode: z.enum(["redacted", "in_country", "off"]).default("redacted"),
        currency: z.literal("QAR").default("QAR"),
        auditRetentionYears: z.number().int().min(5).max(30).default(10),
      })
      .strict()
      .refine((b) => b.supportedLocales.includes(b.defaultLocale), {
        message: "defaultLocale must be one of supportedLocales",
      }),
    consoleUsers: z
      .array(
        z
          .object({
            email: z.email(),
            name: z.string().min(1),
            role: z.enum(["admin", "product", "compliance", "sharia", "viewer"]),
          })
          .strict(),
      )
      .min(1),
    /** Pack keys to install; all implemented packs when omitted. */
    packs: z.array(z.string()).optional(),
    /** The bank's product lines; both when omitted. */
    variants: z.array(Variant).min(1).default(["conventional", "islamic"]),
    /** Schedules for the proactive packs (rewards.expiry, account.dormancy). */
    proactiveSchedules: z.record(z.string(), Cron).default({}),
    /** The bank's published fees, for explain-a-charge. */
    feeSchedule: z
      .array(
        z
          .object({
            code: z.string().min(1),
            nameEn: z.string().min(1),
            nameAr: z.string().min(1),
            descriptionEn: z.string().min(1),
            descriptionAr: z.string().min(1),
            avoidTipEn: z.string().min(1),
            avoidTipAr: z.string().min(1),
            amountRule: z.union([
              z.object({ type: z.literal("fixed"), amount: Money }).strict(),
              z.object({ type: z.literal("pct"), pct: Money, min: Money.optional() }).strict(),
            ]),
          })
          .strict(),
      )
      .default([]),
  })
  .strict()
  .superRefine((c, ctx) => {
    const known = new Set(ALL_PACK_DEFINITIONS.map((d) => d.key));
    for (const key of c.packs ?? []) {
      if (!known.has(key)) ctx.addIssue({ code: "custom", message: `unknown pack ${key}` });
    }
    for (const key of Object.keys(c.proactiveSchedules)) {
      if (!PROACTIVE_RULE_PACK_KEYS.includes(key as never)) {
        ctx.addIssue({ code: "custom", message: `${key} is not a proactive pack` });
      }
    }
    const emails = c.consoleUsers.map((u) => u.email.toLowerCase());
    if (new Set(emails).size !== emails.length) {
      ctx.addIssue({ code: "custom", message: "console user emails must be unique" });
    }
    if (!c.consoleUsers.some((u) => u.role === "compliance")) {
      ctx.addIssue({ code: "custom", message: "needs at least one compliance user (D-074)" });
    }
  });

export type BankConfig = z.infer<typeof BankConfigSchema>;

/** Default schedules for the proactive packs (Asia/Qatar is UTC+3; these run at 09:00 local). */
const DEFAULT_SCHEDULES: Record<string, string> = {
  "account.dormancy": "0 6 * * *",
  "rewards.expiry": "15 6 * * *",
};

export interface BootstrapPlan {
  bank: Prisma.BankCreateInput & { id: string };
  consoleUsers: Prisma.ConsoleUserCreateManyInput[];
  rulePacks: Prisma.RulePackCreateManyInput[];
  templates: Prisma.TemplateCreateManyInput[];
  proactiveJobs: Prisma.ProactiveJobCreateManyInput[];
  feeSchedule: Prisma.FeeScheduleCreateManyInput[];
}

/** Stable console user id: the same email always maps to the same user. */
export function consoleUserId(bankId: string, email: string): string {
  const digest = createHash("sha256").update(`${bankId}:${email.toLowerCase()}`).digest("hex");
  return `cu_${digest.slice(0, 20)}`;
}

/** Everything the bootstrap would write, as plain rows. Pure, so it is unit tested. */
export function planBootstrap(config: BankConfig, now: Date): BootstrapPlan {
  const bankId = config.bank.id;
  const packs = ALL_PACK_DEFINITIONS.filter(
    (d) => (config.packs ?? [d.key]).includes(d.key) && config.variants.includes(d.variant),
  );
  const packKeys = new Set(packs.map((d) => d.key));
  const allPackKeys = new Set(ALL_PACK_DEFINITIONS.map((d) => d.key));
  return {
    bank: {
      ...config.bank,
      supportedLocales: [...config.bank.supportedLocales],
    },
    consoleUsers: config.consoleUsers.map((u) => ({
      id: consoleUserId(bankId, u.email),
      bankId,
      email: u.email.toLowerCase(),
      name: u.name,
      role: u.role,
    })),
    rulePacks: packs.map((d) => ({
      id: `rp_${bankId}_${d.key}_${d.variant}_${d.version}`,
      bankId,
      key: d.key,
      version: d.version,
      variant: d.variant,
      productFamily: d.productFamily,
      status: "active",
      enabled: false,
      parameters: d.parameters as Prisma.InputJsonValue,
      effectiveFrom: now,
      createdBy: "bootstrap",
    })),
    // Pack copy for the installed packs, plus copy that belongs to no pack (compare, Ask AMIL).
    templates: ALL_TEMPLATES.filter(
      (t) =>
        config.bank.supportedLocales.includes(t.locale) &&
        config.variants.includes(t.variant) &&
        (packKeys.has(t.rulePackKey) || !allPackKeys.has(t.rulePackKey)),
    ).map((t) => ({
      id: `tpl_${bankId}_${t.key}_${t.locale}_v${t.version}`,
      bankId,
      key: t.key,
      rulePackKey: t.rulePackKey,
      variant: t.variant,
      locale: t.locale,
      severity: t.severity,
      headline: t.headline,
      body: t.body,
      options: t.options,
      status: "in_review",
      version: t.version,
      enabled: true,
    })),
    proactiveJobs: PROACTIVE_RULE_PACK_KEYS.filter((k) => packKeys.has(k)).map((k) => ({
      bankId,
      rulePackKey: k,
      schedule: config.proactiveSchedules[k] ?? DEFAULT_SCHEDULES[k] ?? "0 6 * * *",
    })),
    feeSchedule: config.feeSchedule.map((f) => ({
      ...f,
      bankId,
      version: 1,
      effectiveFrom: now,
    })),
  };
}

export interface BootstrapResult {
  consoleUsers: number;
  rulePacks: number;
  templates: number;
  proactiveJobs: number;
  feeSchedule: number;
}

/**
 * Write the plan, adding only what is missing. The bank record is upserted (its settings are
 * the bank's configuration); console users are matched by email and keep their role once
 * created, since roles are managed by the bank's admin afterwards.
 */
export async function applyBootstrap(
  prisma: PrismaClient,
  plan: BootstrapPlan,
): Promise<BootstrapResult> {
  const bankId = plan.bank.id;
  return prisma.$transaction(async (tx) => {
    const { id: _id, ...bankUpdate } = plan.bank;
    await tx.bank.upsert({ where: { id: bankId }, create: plan.bank, update: bankUpdate });

    const users = await tx.consoleUser.createMany({
      data: plan.consoleUsers,
      skipDuplicates: true,
    });

    const existingPacks = await tx.rulePack.findMany({
      where: { bankId },
      select: { key: true, variant: true },
    });
    const havePack = new Set(existingPacks.map((p) => `${p.key}/${p.variant}`));
    const packs = await tx.rulePack.createMany({
      data: plan.rulePacks.filter((p) => !havePack.has(`${p.key}/${p.variant}`)),
    });

    const existingTemplates = await tx.template.findMany({
      where: { bankId },
      select: { key: true, locale: true, severity: true },
    });
    const haveTemplate = new Set(
      existingTemplates.map((t) => `${t.key}/${t.locale}/${t.severity}`),
    );
    const templates = await tx.template.createMany({
      data: plan.templates.filter((t) => !haveTemplate.has(`${t.key}/${t.locale}/${t.severity}`)),
    });

    const jobs = await tx.proactiveJob.createMany({
      data: plan.proactiveJobs,
      skipDuplicates: true,
    });

    const existingFees = await tx.feeSchedule.findMany({
      where: { bankId },
      select: { code: true },
    });
    const haveFee = new Set(existingFees.map((f) => f.code));
    const fees = await tx.feeSchedule.createMany({
      data: plan.feeSchedule.filter((f) => !haveFee.has(f.code)),
    });

    return {
      consoleUsers: users.count,
      rulePacks: packs.count,
      templates: templates.count,
      proactiveJobs: jobs.count,
      feeSchedule: fees.count,
    };
  });
}
