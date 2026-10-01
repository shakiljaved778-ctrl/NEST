import { SEVERITY_ORDER, type Severity, type SeverityThresholds } from "./contract";
import type { Dec } from "./money";
import { D } from "./money";

/**
 * Severity from an amount (QAR) and bank thresholds:
 *   amount >= criticalAtQar -> critical; amount >= cautionAtQar -> caution; else info.
 */
export function severityForAmount(amount: Dec, thresholds: SeverityThresholds): Severity {
  if (amount.greaterThanOrEqualTo(D(thresholds.criticalAtQar))) return "critical";
  if (amount.greaterThanOrEqualTo(D(thresholds.cautionAtQar))) return "caution";
  return "info";
}

/** The most severe of the given severities. */
export function maxSeverity(...severities: Severity[]): Severity {
  return severities.reduce<Severity>(
    (acc, s) => (SEVERITY_ORDER[s] > SEVERITY_ORDER[acc] ? s : acc),
    "info",
  );
}
