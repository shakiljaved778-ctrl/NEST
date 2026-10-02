/** Response shapes of the console API (`/v1/admin/*`) as the console uses them. */
import type { ConsoleUser } from "@amil/sdk";

export type Me = { user: ConsoleUser & { bankId: string }; permissions: string[] };
export type Variant = "conventional" | "islamic";
export type Locale = "en" | "ar";
export type Severity = "info" | "caution" | "critical";
export type Issue = { path: string; message: string };

export interface PackVersion {
  id: string;
  version: string;
  status: string;
  enabled: boolean;
  effectiveFrom: string;
  createdAt: string;
  createdBy: string;
  parameters: Record<string, unknown>;
}
export interface PackFact {
  key: string;
  unit: string;
  source: string;
  description: string;
}
export interface Pack {
  key: string;
  variant: Variant;
  productFamily: string;
  triggers: { type: string; event: string }[];
  requiredData: { entity: string; fields: string[] }[];
  facts: PackFact[];
  defaults: Record<string, unknown>;
  current: PackVersion | null;
  scheduled: PackVersion[];
  versions: PackVersion[];
}

export type TemplateStatus =
  "draft" | "in_review" | "compliance_approved" | "approved" | "sharia_approved" | "retired";
export interface Template {
  id: string;
  key: string;
  rulePackKey: string;
  variant: Variant;
  locale: Locale;
  severity: Severity;
  version: number;
  status: TemplateStatus;
  enabled: boolean;
  headline: string;
  body: string;
  options: { key: string; label: string }[];
  approvedBy: string | null;
  approvedAt: string | null;
  createdAt: string;
}
export interface TemplateDetail {
  template: Template;
  versions: Template[];
  history: {
    id: string;
    templateId: string;
    action: string;
    fromStatus: string | null;
    toStatus: string | null;
    actor: string;
    role: string;
    comment: string | null;
    at: string;
  }[];
}
export interface Preview {
  sample: string | null;
  severity: Severity | null;
  headline: string;
  body: string;
  missing: string[];
  violations: string[];
  issues: Issue[] | null;
}

export interface ApprovalEntry {
  id: string;
  entityType: string;
  entityId: string;
  action: string;
  fromStatus: string | null;
  toStatus: string | null;
  actor: string;
  role: string;
  comment: string | null;
  diff: { before: Record<string, unknown>; after: Record<string, unknown> } | null;
  at: string;
}

export interface Dashboard {
  from: string;
  to: string;
  totals: {
    events: number;
    shown: number;
    suppressedOrNotApplicable: number;
    answered: number;
    reconsidered: number;
    reconsideredRatePct: number | null;
    valueSurfacedQar: string;
    valueProtectedQar: string;
    validatorRejectionRatePct: number | null;
    latencyP50Ms: number | null;
    latencyP95Ms: number | null;
  };
  byPack: { key: string; info: number; caution: number; critical: number; total: number }[];
  byDay: { day: string; count: number }[];
  responses: {
    continued: number;
    chose_option: number;
    talk_to_someone: number;
    dismissed: number;
  };
}

export interface AuditSummary {
  id: string;
  seq: string;
  occurredAt: string;
  trigger: string;
  rulePackKey: string;
  rulePackVersion: string;
  variant: Variant;
  locale: Locale;
  applicable: boolean;
  severity: Severity | null;
  templateKey: string | null;
  validatorResult: string;
  modelProvider: string | null;
  latencyMs: number | null;
  headline: string | null;
  suppressed: string | null;
}
export interface FactView {
  key?: string;
  label?: string;
  display?: string;
  value?: string;
  unit?: string;
  source?: string;
  asOf?: string;
}
export interface AuditEventDetail {
  event: AuditSummary & {
    customerRefHash: string;
    inputSnapshotHash: string;
    templateVersion: number | null;
    modelVersion: string | null;
    facts: Record<string, unknown>;
    shown: unknown;
    retentionUntil: string;
    prevHash: string;
    hash: string;
  };
  responses: { id: string; action: string; optionKey: string | null; at: string }[];
  chain: { hashValid: boolean; linkValid: boolean };
}
export interface ChainCheck {
  ok: boolean;
  checked: number;
  firstBrokenSeq: string | null;
  reason: string | null;
}
export interface Complaints {
  customerRef: string;
  chainVerified: boolean;
  insights: (AuditSummary & {
    question: string | null;
    body: string | null;
    facts: FactView[];
    options: { key: string; label: string; deepLink?: string }[];
    aiDisclosure: string | null;
    responses: { action: string; optionKey: string | null; at: string }[];
  })[];
}
export interface CompliancePack {
  generatedAt: string;
  bank: { name: string; modelMode: string; digitStyle: string };
  modelCard: {
    purpose: string;
    modes: Record<string, string>;
    currentMode: string;
    providers: {
      redacted: { name: string; model: string } | null;
      inCountry: { name: string; model: string } | null;
    };
    promptVersion: string;
    deadlineMs: number;
    wordingCache: string;
    safeguards: string[];
  };
  dataFlow: string[];
  packs: {
    key: string;
    variant: Variant;
    version: string;
    productFamily: string;
    triggers: { type: string; event: string }[];
    requiredData: { entity: string; fields: string[] }[];
    facts: PackFact[];
  }[];
  redaction: { neverSent: string[]; samplePayload: unknown };
  retention: { auditRetentionYears: number; rule: string };
  consentPurposes: { purpose: string; use: string }[];
}
