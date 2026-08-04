import { z } from "zod";

// Shared Zod schemas — used by client forms, server actions, and API routes.

export const emailField = z
  .string()
  .trim()
  .email()
  .max(200)
  .transform((v) => v.toLowerCase());

export const phoneField = z.string().trim().min(6).max(30);

export const leadCreateSchema = z.object({
  firstName: z.string().trim().min(1).max(100),
  lastName: z.string().trim().min(1).max(100),
  company: z.string().trim().max(200).optional().nullable(),
  email: emailField.optional().nullable().or(z.literal("").transform(() => null)),
  phone: phoneField.optional().nullable().or(z.literal("").transform(() => null)),
  source: z.string().trim().max(50).default("manual"),
  channel: z.string().trim().max(50).optional().nullable(),
  campaign: z.string().trim().max(100).optional().nullable(),
  territory: z.string().trim().max(100).optional().nullable(),
  productInterestId: z.string().optional().nullable(),
  score: z.coerce.number().int().min(0).max(100).default(0),
  ownerId: z.string().optional().nullable(),
  notes: z.string().max(5000).optional().nullable(),
  lawfulBasis: z.enum(["CONSENT", "CONTRACT", "LEGITIMATE_INTEREST"]).optional().nullable(),
  consent: z.coerce.boolean().optional(),
  customFields: z.record(z.unknown()).optional(),
});

export const leadUpdateSchema = leadCreateSchema.partial().extend({
  status: z.enum(["NEW", "CONTACTED", "QUALIFIED", "CONVERTED", "DISQUALIFIED"]).optional(),
  disqualifyReason: z.string().max(500).optional().nullable(),
});

export const leadCaptureSchema = z.object({
  token: z.string().min(8).max(100),
  firstName: z.string().trim().min(1).max(100),
  lastName: z.string().trim().min(1).max(100).default("—"),
  company: z.string().trim().max(200).optional(),
  email: emailField.optional(),
  phone: phoneField.optional(),
  territory: z.string().trim().max(100).optional(),
  productInterest: z.string().trim().max(100).optional(),
  message: z.string().max(2000).optional(),
  consent: z.coerce.boolean().default(false),
  // honeypot — bots fill it, humans never see it
  website_url: z.string().max(0).optional().or(z.literal("")),
});

export const convertLeadSchema = z.object({
  leadId: z.string(),
  // account: link existing or create new (B2B); "none" for B2C individual
  accountMode: z.enum(["new", "existing", "none"]),
  existingAccountId: z.string().optional(),
  accountName: z.string().trim().max(200).optional(),
  contactMode: z.enum(["new", "existing"]).default("new"),
  existingContactId: z.string().optional(),
  createDeal: z.coerce.boolean().default(true),
  dealName: z.string().trim().max(200).optional(),
  dealValue: z.coerce.number().min(0).default(0),
  dealProductId: z.string().optional(),
});

export const activityCreateSchema = z.object({
  type: z.enum(["CALL", "MEETING", "NOTE", "EMAIL"]),
  subject: z.string().trim().min(1).max(200),
  body: z.string().max(10000).optional().nullable(),
  occurredAt: z.coerce.date().optional(),
  leadId: z.string().optional().nullable(),
  accountId: z.string().optional().nullable(),
  contactId: z.string().optional().nullable(),
  dealId: z.string().optional().nullable(),
});

export const taskCreateSchema = z.object({
  title: z.string().trim().min(1).max(200),
  description: z.string().max(5000).optional().nullable(),
  dueAt: z.coerce.date(),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).default("MEDIUM"),
  ownerId: z.string().optional(),
  leadId: z.string().optional().nullable(),
  accountId: z.string().optional().nullable(),
  contactId: z.string().optional().nullable(),
  dealId: z.string().optional().nullable(),
  recurrence: z
    .object({ freq: z.enum(["DAILY", "WEEKLY", "MONTHLY"]), interval: z.number().int().min(1).max(12) })
    .optional()
    .nullable(),
});

export const accountSchema = z.object({
  legalName: z.string().trim().min(1).max(200),
  tradeName: z.string().trim().max(200).optional().nullable(),
  crNumber: z.string().trim().max(50).optional().nullable(),
  industry: z.string().trim().max(100).optional().nullable(),
  size: z.string().trim().max(20).optional().nullable(),
  website: z.string().trim().url().max(300).optional().nullable().or(z.literal("").transform(() => null)),
  address: z.string().trim().max(500).optional().nullable(),
  city: z.string().trim().max(100).optional().nullable(),
  territory: z.string().trim().max(100).optional().nullable(),
  status: z.enum(["PROSPECT", "ACTIVE", "CHURNED"]).default("PROSPECT"),
  ownerId: z.string().optional().nullable(),
  customFields: z.record(z.unknown()).optional(),
});

export const contactSchema = z.object({
  firstName: z.string().trim().min(1).max(100),
  lastName: z.string().trim().min(1).max(100),
  accountId: z.string().optional().nullable(),
  clientStatus: z.enum(["PROSPECT", "ACTIVE", "CHURNED"]).optional().nullable(),
  position: z.string().trim().max(100).optional().nullable(),
  email: emailField.optional().nullable().or(z.literal("").transform(() => null)),
  email2: emailField.optional().nullable().or(z.literal("").transform(() => null)),
  phone: phoneField.optional().nullable().or(z.literal("").transform(() => null)),
  phone2: phoneField.optional().nullable().or(z.literal("").transform(() => null)),
  idDocType: z.enum(["QID", "PASSPORT"]).optional().nullable(),
  nationalId: z.string().trim().max(30).optional().nullable().or(z.literal("").transform(() => null)),
  nationality: z.string().trim().max(60).optional().nullable(),
  preferredLanguage: z.enum(["EN", "AR"]).default("EN"),
  ownerId: z.string().optional().nullable(),
  lawfulBasis: z.enum(["CONSENT", "CONTRACT", "LEGITIMATE_INTEREST"]).optional().nullable(),
  customFields: z.record(z.unknown()).optional(),
});

export const dealSchema = z.object({
  name: z.string().trim().min(1).max(200),
  pipelineId: z.string(),
  stageId: z.string(),
  value: z.coerce.number().min(0).default(0),
  currency: z.string().length(3).default("QAR"),
  fxRateToQar: z.coerce.number().positive().default(1),
  expectedCloseAt: z.coerce.date().optional().nullable(),
  probability: z.coerce.number().int().min(0).max(100).optional().nullable(),
  ownerId: z.string().optional().nullable(),
  accountId: z.string().optional().nullable(),
  primaryContactId: z.string().optional().nullable(),
  customFields: z.record(z.unknown()).optional(),
  products: z
    .array(z.object({ productId: z.string(), quantity: z.coerce.number().int().min(1), unitPrice: z.coerce.number().min(0) }))
    .optional(),
});

export const subscriptionSchema = z.object({
  accountId: z.string().optional().nullable(),
  contactId: z.string().optional().nullable(),
  productId: z.string(),
  dealId: z.string().optional().nullable(),
  startDate: z.coerce.date(),
  renewalDate: z.coerce.date().optional().nullable(),
  status: z.enum(["ACTIVE", "EXPIRED", "CANCELLED"]).default("ACTIVE"),
  mrrValue: z.coerce.number().min(0).default(0),
});

export const routingRuleSchema = z.object({
  name: z.string().trim().min(1).max(200),
  priority: z.coerce.number().int().min(0).max(999).default(0),
  active: z.coerce.boolean().default(true),
  isFallback: z.coerce.boolean().default(false),
  criteria: z.object({
    sources: z.array(z.string()).optional(),
    channels: z.array(z.string()).optional(),
    territories: z.array(z.string()).optional(),
    productIds: z.array(z.string()).optional(),
    minScore: z.coerce.number().int().min(0).max(100).optional(),
    maxScore: z.coerce.number().int().min(0).max(100).optional(),
  }),
  targetType: z.enum(["REP", "TEAM_ROUND_ROBIN"]),
  targetRepId: z.string().optional().nullable(),
  targetTeamId: z.string().optional().nullable(),
});

export const savedViewSchema = z.object({
  entity: z.enum(["lead", "client", "deal"]),
  name: z.string().trim().min(1).max(100),
  filters: z.record(z.unknown()),
  shared: z.coerce.boolean().default(false),
});

export type LeadCreateInput = z.infer<typeof leadCreateSchema>;
export type ConvertLeadInput = z.infer<typeof convertLeadSchema>;
