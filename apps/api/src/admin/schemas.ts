/** Request schemas for the console API, shared by the routes and the OpenAPI document. */
import { z } from "zod";

const Variant = z.enum(["conventional", "islamic"]);
const Locale = z.enum(["en", "ar"]);
const Comment = z.string().max(500).optional();
const DateQ = z.string().datetime().optional();

export const PackParams = z.object({
  key: z.string().regex(/^[a-z_]+\.[a-z_]+$/),
  variant: Variant,
});
export const IdParam = z.object({ id: z.string().min(1).max(64) });

export const ConsoleSessionRequest = z
  .object({
    consoleUserId: z.string().min(1).max(64),
    /** How the console backend authenticated the staff member (recorded, D-077). */
    method: z.enum(["demo", "okta"]).optional(),
  })
  .strict();
export const DateRangeQuery = z.object({ from: DateQ, to: DateQ }).strict();

export const PackVersionRequest = z
  .object({
    parameters: z.record(z.string(), z.unknown()),
    effectiveFrom: z.string().datetime().optional(),
    comment: Comment,
  })
  .strict();
export const EnabledRequest = z.object({ enabled: z.boolean(), comment: Comment }).strict();
export const PackReviewRequest = z
  .object({ action: z.enum(["approve", "reject"]), comment: Comment })
  .strict();

export const TemplateListQuery = z
  .object({
    rulePackKey: z.string().max(64).optional(),
    locale: Locale.optional(),
    status: z.string().max(32).optional(),
  })
  .strict();
export const TemplatePreviewRequest = z
  .object({
    rulePackKey: z.string().max(64),
    variant: Variant,
    locale: Locale,
    severity: z.enum(["info", "caution", "critical"]).optional(),
    headline: z.string().max(400),
    body: z.string().max(2000),
    baseId: z.string().min(1).max(64).optional(),
  })
  .strict();
export const TemplateDraftRequest = z
  .object({
    baseId: z.string().min(1).max(64),
    headline: z.string().min(1).max(400),
    body: z.string().min(1).max(2000),
    options: z
      .array(z.object({ key: z.string().max(64), label: z.string().min(1).max(80) }))
      .optional(),
    comment: Comment,
  })
  .strict();
export const TemplateTransitionRequest = z
  .object({
    action: z.enum(["submit", "approve", "sharia_approve", "reject"]),
    comment: Comment,
  })
  .strict();

export const AuditQuery = z
  .object({
    customerRef: z.string().min(1).max(64).optional(),
    rulePackKey: z.string().max(64).optional(),
    from: DateQ,
    to: DateQ,
    limit: z.coerce.number().int().min(1).max(500).optional(),
    before: z.string().regex(/^\d+$/).optional(),
  })
  .strict();
export const AuditExportQuery = AuditQuery.extend({ format: z.enum(["csv", "json"]) }).strict();
export const ComplaintsQuery = z
  .object({ customerRef: z.string().min(1).max(64), from: DateQ, to: DateQ })
  .strict();

const StaffRole = z.enum(["admin", "product", "compliance", "sharia", "viewer"]);
export const StaffCreateRequest = z
  .object({
    email: z.email().max(254),
    name: z.string().trim().min(1).max(120),
    role: StaffRole,
  })
  .strict();
export const StaffUpdateRequest = z
  .object({
    role: StaffRole.optional(),
    active: z.boolean().optional(),
    /** Why access changed (kept in the approval log, D-081). */
    comment: z.string().trim().min(3).max(500),
  })
  .strict()
  .refine((b) => b.role !== undefined || b.active !== undefined, {
    message: "change the role or the active flag",
  });
