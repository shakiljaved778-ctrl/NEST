import {
  demoContexts,
  loadCustomerBundle,
  type Prisma,
  type PrismaClient,
  resolvePackInput,
  thresholdsFor,
} from "@amil/db";
import { formatFact } from "@amil/gateway";
import {
  copyPolicy,
  copyViolations,
  factLabel,
  getPack,
  isPackKey,
  longestVariant,
  renderTemplate,
  stripTemplateSyntax,
  templateFactKeys,
} from "@amil/rule-packs";
import type { AnyEvaluation, Fact, Variant } from "@amil/rules-engine";
import { z } from "zod";
import { HttpError, notFound } from "../errors";
import type { ConsoleUser } from "./guard";
import { ConsoleValidationError } from "./packs";

type Locale = "en" | "ar";
type TemplateRow = Awaited<ReturnType<PrismaClient["template"]["findMany"]>>[number];
const Options = z.array(z.object({ key: z.string(), label: z.string() }));

export const templateView = (t: TemplateRow) => ({
  id: t.id,
  key: t.key,
  rulePackKey: t.rulePackKey,
  variant: t.variant,
  locale: t.locale,
  severity: t.severity,
  version: t.version,
  status: t.status,
  enabled: t.enabled,
  headline: t.headline,
  body: t.body,
  options: Options.parse(t.options),
  approvedBy: t.approvedBy,
  approvedAt: t.approvedAt?.toISOString() ?? null,
  createdAt: t.createdAt.toISOString(),
});

export async function listTemplates(
  prisma: PrismaClient,
  bankId: string,
  q: { rulePackKey?: string | undefined; locale?: Locale | undefined; status?: string | undefined },
) {
  const rows = await prisma.template.findMany({
    where: {
      bankId,
      ...(q.rulePackKey ? { rulePackKey: q.rulePackKey } : {}),
      ...(q.locale ? { locale: q.locale } : {}),
      ...(q.status ? { status: q.status as TemplateRow["status"] } : {}),
    },
    orderBy: [{ rulePackKey: "asc" }, { key: "asc" }, { locale: "asc" }, { version: "desc" }],
  });
  return rows.map(templateView);
}

export async function getTemplate(prisma: PrismaClient, bankId: string, id: string) {
  const t = await prisma.template.findFirst({ where: { id, bankId } });
  if (!t) throw notFound();
  const versions = await prisma.template.findMany({
    where: { bankId, key: t.key, locale: t.locale, severity: t.severity },
    orderBy: { version: "desc" },
  });
  const history = await prisma.approvalLog.findMany({
    where: { bankId, entityType: "template", entityId: { in: versions.map((v) => v.id) } },
    orderBy: [{ at: "desc" }, { id: "desc" }],
    include: { actor: { select: { name: true, role: true } } },
  });
  return {
    template: templateView(t),
    versions: versions.map(templateView),
    history: history.map((h) => ({
      id: h.id,
      templateId: h.entityId,
      action: h.action,
      fromStatus: h.fromStatus,
      toStatus: h.toStatus,
      actor: h.actor.name,
      role: h.actor.role,
      comment: h.comment,
      at: h.at.toISOString(),
    })),
  };
}

/** Facts a template may reference: the pack's declared facts, or the labelled ones for phrases. */
function allowedFact(rulePackKey: string, variant: Variant, locale: Locale, key: string): boolean {
  if (isPackKey(rulePackKey))
    return getPack(rulePackKey, variant).definition.facts.some((f) => f.key === key);
  return factLabel(rulePackKey, locale, key) !== key;
}

/**
 * The checks a draft must pass before it can be saved, and again before it is approved: copy
 * policy (selling terms, Sharia terminology, no "!" or emojis), only known facts, no figures in the
 * literal copy (figures come from facts), generic copy has no placeholders, option keys unchanged.
 */
export function checkCopy(
  base: Pick<TemplateRow, "key" | "rulePackKey" | "variant" | "locale">,
  draft: { headline: string; body: string; options: { key: string; label: string }[] },
  baseOptions: { key: string; label: string }[],
): { path: string; message: string }[] {
  const issues: { path: string; message: string }[] = [];
  const locale = base.locale;
  for (const [path, text] of [
    ["headline", draft.headline],
    ["body", draft.body],
    ...draft.options.map((o, i) => [`options.${i}.label`, o.label] as const),
  ] as const) {
    if (!text.trim()) issues.push({ path, message: "must not be empty" });
    for (const v of copyViolations(stripTemplateSyntax(text), locale, base.variant))
      issues.push({ path, message: v });
    const { sections, placeholders } = templateFactKeys(text);
    for (const k of [...sections, ...placeholders]) {
      if (base.key.endsWith(".generic"))
        issues.push({ path, message: `generic copy cannot use customer data: ${k}` });
      else if (!allowedFact(base.rulePackKey, base.variant, locale, k))
        issues.push({ path, message: `unknown fact: ${k}` });
    }
    const literal = text.replace(/\{\w+\}/g, " ").replace(/\[\[!?\w+:/g, " ");
    if (/[0-9٠-٩]/.test(literal))
      issues.push({ path, message: "figures must come from facts, not literal digits" });
  }
  // Placeholders count as written ({factKey}); the preview checks the rendered length.
  if (longestVariant(draft.headline).length > copyPolicy.maxHeadlineChars + 40)
    issues.push({ path: "headline", message: "too long" });
  if (
    JSON.stringify(draft.options.map((o) => o.key)) !==
    JSON.stringify(baseOptions.map((o) => o.key))
  )
    issues.push({ path: "options", message: "option keys and order must stay the same" });
  return issues;
}

/** A new draft version of an approved template (product). Never served until approved. */
export async function createDraft(
  prisma: PrismaClient,
  user: ConsoleUser,
  body: {
    baseId: string;
    headline: string;
    body: string;
    options?: { key: string; label: string }[] | undefined;
    comment?: string | undefined;
  },
  now: Date,
) {
  const base = await prisma.template.findFirst({ where: { id: body.baseId, bankId: user.bankId } });
  if (!base) throw notFound();
  const baseOptions = Options.parse(base.options);
  const draft = { headline: body.headline, body: body.body, options: body.options ?? baseOptions };
  const issues = checkCopy(base, draft, baseOptions);
  if (issues.length) throw new ConsoleValidationError("invalid_template", issues);
  const latest = await prisma.template.findFirst({
    where: { bankId: user.bankId, key: base.key, locale: base.locale, severity: base.severity },
    orderBy: { version: "desc" },
  });
  return prisma.$transaction(async (tx) => {
    const row = await tx.template.create({
      data: {
        bankId: user.bankId,
        key: base.key,
        rulePackKey: base.rulePackKey,
        variant: base.variant,
        locale: base.locale,
        severity: base.severity,
        headline: draft.headline,
        body: draft.body,
        options: draft.options,
        status: "draft",
        version: (latest?.version ?? 0) + 1,
        enabled: true,
        createdAt: now,
      },
    });
    await log(tx, user, row.id, "draft_created", null, "draft", body.comment, now, {
      before: { headline: base.headline, body: base.body },
      after: { headline: row.headline, body: row.body },
    });
    return templateView(row);
  });
}

type Action = "submit" | "approve" | "sharia_approve" | "reject";
const TRANSITIONS: Record<Action, { from: TemplateRow["status"][]; role: ConsoleUser["role"][] }> =
  {
    submit: { from: ["draft"], role: ["product"] },
    approve: { from: ["in_review"], role: ["compliance"] },
    sharia_approve: { from: ["compliance_approved"], role: ["sharia"] },
    reject: { from: ["in_review", "compliance_approved"], role: ["compliance", "sharia"] },
  };

/**
 * The approval workflow (section 11): product submits -> compliance approves (conventional copy
 * is then live) -> for Islamic copy, the Sharia reviewer approves. On final approval earlier
 * versions are retired, so exactly one version per key, locale and severity can be served.
 */
export async function transition(
  prisma: PrismaClient,
  user: ConsoleUser,
  id: string,
  action: Action,
  comment: string | undefined,
  now: Date,
) {
  const t = await prisma.template.findFirst({ where: { id, bankId: user.bankId } });
  if (!t) throw notFound();
  const rule = TRANSITIONS[action];
  if (!rule.role.includes(user.role)) throw new HttpError(403, "forbidden");
  if (!rule.from.includes(t.status))
    throw new ConsoleValidationError("invalid_transition", [
      { path: "status", message: `cannot ${action} from ${t.status}` },
    ]);
  if (action === "sharia_approve" && t.variant !== "islamic")
    throw new ConsoleValidationError("invalid_transition", []);
  if (action === "reject" && t.status === "compliance_approved" && user.role !== "sharia")
    throw new HttpError(403, "forbidden");
  if (action === "reject" && t.status === "in_review" && user.role !== "compliance")
    throw new HttpError(403, "forbidden");
  if (action === "approve" || action === "sharia_approve") {
    const issues = checkCopy(
      t,
      { headline: t.headline, body: t.body, options: Options.parse(t.options) },
      Options.parse(t.options),
    );
    if (issues.length) throw new ConsoleValidationError("invalid_template", issues);
  }
  const to: TemplateRow["status"] =
    action === "submit"
      ? "in_review"
      : action === "reject"
        ? "draft"
        : action === "approve"
          ? t.variant === "islamic"
            ? "compliance_approved"
            : "approved"
          : "sharia_approved";
  const final = to === "approved" || to === "sharia_approved";
  return prisma.$transaction(async (tx) => {
    if (final)
      await tx.template.updateMany({
        where: {
          bankId: user.bankId,
          key: t.key,
          locale: t.locale,
          severity: t.severity,
          id: { not: t.id },
          status: { in: ["approved", "sharia_approved"] },
        },
        data: { status: "retired" },
      });
    const row = await tx.template.update({
      where: { id: t.id },
      data: { status: to, ...(final ? { approvedBy: user.id, approvedAt: now } : {}) },
    });
    await log(
      tx,
      user,
      t.id,
      action === "submit"
        ? "submitted"
        : action === "reject"
          ? "rejected"
          : action === "approve"
            ? "approved"
            : "sharia_approved",
      t.status,
      to,
      comment,
      now,
    );
    return templateView(row);
  });
}

/** Kill switch for one template (non-negotiable 9): a disabled template means no insight. */
export async function setTemplateEnabled(
  prisma: PrismaClient,
  user: ConsoleUser,
  id: string,
  enabled: boolean,
  comment: string | undefined,
  now: Date,
) {
  const t = await prisma.template.findFirst({ where: { id, bankId: user.bankId } });
  if (!t) throw notFound();
  return prisma.$transaction(async (tx) => {
    const row = await tx.template.update({ where: { id }, data: { enabled } });
    await log(tx, user, id, enabled ? "enabled" : "disabled", t.status, t.status, comment, now);
    return templateView(row);
  });
}

async function log(
  tx: Prisma.TransactionClient,
  user: ConsoleUser,
  entityId: string,
  action: string,
  fromStatus: string | null,
  toStatus: string | null,
  comment: string | undefined,
  at: Date,
  diff?: object,
) {
  await tx.approvalLog.create({
    data: {
      bankId: user.bankId,
      entityType: "template",
      entityId,
      action,
      fromStatus,
      toStatus,
      actorId: user.id,
      comment: comment ?? null,
      ...(diff ? { diff: diff } : {}),
      at,
    },
  });
}

/**
 * Live preview: renders draft copy against a real evaluation of a synthetic demo customer for whom
 * the pack fires (preferring the requested severity). Demo data only; a production console would
 * preview against a bank-provided test profile, never a real customer.
 */
export async function previewTemplate(
  prisma: PrismaClient,
  bankId: string,
  q: {
    rulePackKey: string;
    variant: Variant;
    locale: Locale;
    severity?: string | undefined;
    headline: string;
    body: string;
    baseId?: string | undefined;
  },
  now: Date,
) {
  const bank = await prisma.bank.findUniqueOrThrow({ where: { id: bankId } });
  // With the template being edited, the preview also runs the checks a draft must pass on save.
  const base = q.baseId
    ? await prisma.template.findFirst({ where: { id: q.baseId, bankId } })
    : null;
  if (q.baseId && !base) throw notFound();
  const baseOptions = base ? Options.parse(base.options) : [];
  const issues = base
    ? checkCopy(base, { headline: q.headline, body: q.body, options: baseOptions }, baseOptions)
    : null;
  const display = { locale: q.locale, digitStyle: bank.digitStyle };
  let evaluation: AnyEvaluation | null = null;
  let sample: string | null = null;
  if (isPackKey(q.rulePackKey)) {
    const pack = q.rulePackKey;
    const customers = await prisma.customer.findMany({
      where: {
        bankId,
        personaKey: { not: null },
        consents: { some: { purpose: "pre_decision_insights", withdrawnAt: null } },
      },
      select: { id: true, personaKey: true },
      orderBy: { externalRef: "asc" },
    });
    outer: for (const c of customers) {
      const bundle = await loadCustomerBundle(prisma, c.id);
      if (!bundle) continue;
      const contexts = demoContexts(pack, bundle);
      if (pack === "card.epp_conversion") continue; // needs a transaction id; covered by other packs
      for (const ctx of contexts) {
        const r = resolvePackInput(pack, bundle, ctx, now);
        if (!r || r.variant !== q.variant) continue;
        const p = getPack(pack, r.variant);
        const ev = p.evaluate(
          r.input as never,
          p.defaultParameters,
          thresholdsFor(bank.severityThresholds, pack),
          now,
        );
        if (!ev.applicable) continue;
        if (!evaluation || (q.severity && ev.severity === q.severity)) {
          evaluation = ev;
          sample = c.personaKey;
        }
        if (!q.severity || ev.severity === q.severity) break outer;
      }
    }
  }
  const facts = evaluation?.facts ?? { _sources: [] };
  const format = (f: Fact) => formatFact(f, display);
  const headline = renderTemplate(q.headline, facts, format);
  const body = renderTemplate(q.body, facts, format);
  return {
    sample,
    severity: evaluation?.severity ?? null,
    headline: headline.text,
    body: body.text,
    missing: [...new Set([...headline.missing, ...body.missing])],
    issues,
    violations: [
      ...copyViolations(stripTemplateSyntax(`${q.headline}\n${q.body}`), q.locale, q.variant),
      ...(headline.text.length > copyPolicy.maxHeadlineChars ? ["headline_too_long"] : []),
    ],
  };
}
