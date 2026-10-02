import type { PrismaClient } from "@amil/db";
import { isPackKey, VALUE_AT_STAKE_FACT } from "@amil/rule-packs";
import { D, type Dec, toMoneyString } from "@amil/rules-engine";

const pct = (n: number, d: number) => (d === 0 ? null : Math.round((n / d) * 1000) / 10);
function percentile(sorted: number[], p: number): number | null {
  if (!sorted.length) return null;
  return sorted[Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1)] ?? null;
}

/**
 * Dashboard (section 11), computed from the audit log:
 * - insights shown by pack and severity, and per day;
 * - customer responses (continued / chose an option / talk to someone / dismissed);
 * - reconsidered actions: an action insight answered without "continued" (the customer chose
 *   another path, asked for help or dismissed, rather than going ahead);
 * - value surfaced (sum of each pack's value-at-stake fact) and protected (on reconsidered ones);
 * - validator rejection rate and check latency (p50 / p95).
 */
export async function dashboard(prisma: PrismaClient, bankId: string, from: Date, to: Date) {
  const events = await prisma.insightEvent.findMany({
    where: { bankId, occurredAt: { gte: from, lte: to } },
    select: {
      id: true,
      occurredAt: true,
      trigger: true,
      rulePackKey: true,
      applicable: true,
      severity: true,
      templateKey: true,
      validatorResult: true,
      latencyMs: true,
      facts: true,
      responses: { select: { action: true } },
    },
  });
  const shown = events.filter((e) => e.applicable && e.templateKey && isPackKey(e.rulePackKey));
  const byPack = new Map<string, { info: number; caution: number; critical: number }>();
  const byDay = new Map<string, number>();
  const responses = { continued: 0, chose_option: 0, talk_to_someone: 0, dismissed: 0 };
  let answered = 0;
  let reconsidered = 0;
  let surfaced: Dec = D(0);
  let protectedValue: Dec = D(0);
  for (const e of shown) {
    const p = byPack.get(e.rulePackKey) ?? { info: 0, caution: 0, critical: 0 };
    if (e.severity) p[e.severity]++;
    byPack.set(e.rulePackKey, p);
    const day = e.occurredAt.toISOString().slice(0, 10);
    byDay.set(day, (byDay.get(day) ?? 0) + 1);
    for (const r of e.responses) responses[r.action]++;
    const valueKey = isPackKey(e.rulePackKey) ? VALUE_AT_STAKE_FACT[e.rulePackKey] : null;
    const fact = valueKey
      ? (e.facts as Record<string, { value?: string } | undefined>)[valueKey]
      : undefined;
    const value = fact?.value && /^-?\d+(\.\d+)?$/.test(fact.value) ? D(fact.value) : D(0);
    surfaced = surfaced.plus(value);
    if (e.trigger.startsWith("action:") && e.responses.length) {
      answered++;
      const kinds = new Set(e.responses.map((r) => r.action));
      if (!kinds.has("continued")) {
        reconsidered++;
        protectedValue = protectedValue.plus(value);
      }
    }
  }
  const validated = events.filter((e) => e.validatorResult !== "not_used");
  const rejected = validated.filter((e) => e.validatorResult === "rejected").length;
  const latencies = shown
    .filter((e) => e.trigger.startsWith("action:") && e.latencyMs !== null)
    .map((e) => e.latencyMs as number)
    .sort((a, b) => a - b);
  const suppressed = events.filter((e) => !e.applicable).length;
  return {
    from: from.toISOString(),
    to: to.toISOString(),
    totals: {
      events: events.length,
      shown: shown.length,
      suppressedOrNotApplicable: suppressed,
      answered,
      reconsidered,
      reconsideredRatePct: pct(reconsidered, answered),
      valueSurfacedQar: toMoneyString(surfaced),
      valueProtectedQar: toMoneyString(protectedValue),
      validatorRejectionRatePct: pct(rejected, validated.length),
      latencyP50Ms: percentile(latencies, 50),
      latencyP95Ms: percentile(latencies, 95),
    },
    byPack: [...byPack.entries()]
      .sort()
      .map(([key, s]) => ({ key, ...s, total: s.info + s.caution + s.critical })),
    byDay: [...byDay.entries()].sort().map(([day, count]) => ({ day, count })),
    responses,
  };
}
