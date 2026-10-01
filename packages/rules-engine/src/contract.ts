/**
 * The rules-engine contract (master prompt section 5).
 *
 * A rule pack is a pure function of (input, params, now). It performs no I/O and never reads
 * the clock. Every value a customer will see is a `Fact` with a source and an as-of date
 * (non-negotiable 1). The LLM may only word facts; it never produces them.
 */

export type Variant = "conventional" | "islamic";
export type Severity = "info" | "caution" | "critical";

export const SEVERITY_ORDER: Record<Severity, number> = { info: 0, caution: 1, critical: 2 };

/** Where a fact came from. Extend as new packs read new data. */
export type FactSourceName =
  | "rewards_ledger"
  | "card"
  | "instalment_plan"
  | "finance"
  | "finance_schedule"
  | "deposit"
  | "account"
  | "standing_order"
  | "fee_schedule"
  | "customer"
  | "rule_pack"
  | "computed";

/** Units drive formatting (Phase 3) and number validation. */
export type FactUnit =
  "QAR" | "points" | "count" | "days" | "months" | "date" | "percent" | "boolean" | "code";

/** Values are always strings: decimal strings for money and quantities, ISO dates, "true"/"false". */
export interface Fact {
  key: string;
  value: string;
  unit: FactUnit;
  source: FactSourceName;
  /** ISO date (YYYY-MM-DD) the underlying data is valid for. */
  asOf: string;
}

export interface FactSource {
  source: FactSourceName;
  asOf: string;
}

/** A fact set whose keys are not known statically (e.g. one read back from the audit log). */
export interface AnyFactSet {
  _sources: FactSource[];
  [key: string]: Fact | FactSource[];
}

/** Facts keyed by fact key, plus `_sources`. */
export type FactSet<K extends string> = Record<K, Fact> & { _sources: FactSource[] };

export type OptionKey =
  | "redeem_points"
  | "view_instalments"
  | "continue_closure"
  | "settle_now"
  | "schedule_settlement"
  | "partial_prepayment"
  | "talk_to_someone";

export interface Evaluation<K extends string> {
  /** false => no insight is shown. */
  applicable: boolean;
  severity: Severity;
  facts: FactSet<K>;
  /** Ordered: the loss-avoiding path first, then the "continue" path, then talk_to_someone. */
  options: OptionKey[];
  /** Machine-readable reasons behind "Why am I seeing this?". */
  explanation: string[];
}

/**
 * An evaluation handled without knowing its pack (rendering, auditing, the API). Any
 * `Evaluation<K>` is assignable to it.
 */
export interface AnyEvaluation {
  applicable: boolean;
  severity: Severity;
  facts: AnyFactSet;
  options: OptionKey[];
  explanation: string[];
}

export interface Trigger {
  type: "action" | "schedule";
  /** e.g. "card.close" for actions, a cron expression for schedules */
  event: string;
}

export interface DataRequirement {
  entity: string;
  fields: string[];
}

/** Bank-configured severity thresholds (QAR strings). */
export interface SeverityThresholds {
  cautionAtQar: string;
  criticalAtQar: string;
}

export interface RulePack<I, P, K extends string> {
  key: string;
  version: string;
  variant: Variant;
  productFamily: string;
  triggers: Trigger[];
  requiredData: DataRequirement[];
  /** Default parameters from the versioned pack JSON. The bank can override them via the console. */
  defaultParameters: P;
  evaluate(input: I, params: P, thresholds: SeverityThresholds, now: Date): Evaluation<K>;
}
