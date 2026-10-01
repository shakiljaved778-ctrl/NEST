import {
  addDays,
  D,
  type Dec,
  type Fact,
  type FactSet,
  FactBuilder,
  isoDate,
  max,
  type OptionKey,
  startOfUtcDay,
  toMoneyString,
} from "@amil/rules-engine";
import type { DepositBreakInput, DepositBreakParams } from "../deposit-break/pack";
import { evaluateDepositBreak } from "../deposit-break/pack";
import {
  evaluateFinanceEarlySettlement,
  quoteSettlement,
  type SettlementQuote,
} from "../finance-early-settlement/calculate";
import type {
  FinanceSettlementInput,
  FinanceSettlementParams,
} from "../finance-early-settlement/types";
import type { MinimumPaymentInput, MinimumPaymentParams } from "../minimum-payment/pack";
import { evaluateMinimumPayment } from "../minimum-payment/pack";
import { amortiseRevolving } from "../shared/finance-math";

/**
 * Compare views (section 7, `POST /v1/compare`): the customer's own options side by side, each
 * computed by the same engine functions the rule packs use, so a comparison can never disagree
 * with the insight card for the same product. Pure: `now` is injected.
 */
export const COMPARE_SCENARIOS = [
  "settlement_timing",
  "min_vs_custom_payment",
  "deposit_break_vs_wait",
] as const;
export type CompareScenario = (typeof COMPARE_SCENARIOS)[number];

export interface CompareOption {
  /** Stable key of the option (copy: `optionTitles`). */
  key: string;
  /** The cheapest / best-value option in this comparison. */
  best: boolean;
  facts: FactSet<string>;
  /** Bank deep link option that acts on this choice (non-negotiable 3: inform, never execute). */
  action: OptionKey | null;
}

export interface Comparison {
  scenario: CompareScenario;
  applicable: boolean;
  /** Headline facts for the approved summary copy. */
  summary: FactSet<string>;
  options: CompareOption[];
}

const NEUTRAL_THRESHOLDS = { cautionAtQar: "0.00", criticalAtQar: "0.00" };

// ── settlement_timing ──────────────────────────────────────────────────────────────────────────

/**
 * Settle today, on the earliest cheapest date within the horizon (the finance.early_settlement
 * result), and the day after the next instalment (when that is a different date in the horizon).
 * Worked example (Fatima, Phase 2): today vs 19 October, saving 4,000.00.
 */
export function compareSettlementTiming(
  input: FinanceSettlementInput,
  params: FinanceSettlementParams,
  now: Date,
): Comparison {
  const today = startOfUtcDay(now);
  const asOf = isoDate(input.dataAsOf);
  const ev = evaluateFinanceEarlySettlement(input, params, NEUTRAL_THRESHOLDS, now);
  const todayQuote = quoteSettlement(input, params, today, today);
  const cheapestDate = new Date(`${ev.facts.cheapestSettlementDate.value}T00:00:00Z`);
  const horizonEnd = addDays(today, params.horizonDays);
  const next = ev.facts.nextInstalmentDate.value
    ? addDays(new Date(`${ev.facts.nextInstalmentDate.value}T00:00:00Z`), 1)
    : null;

  const option = (key: string, q: SettlementQuote, action: OptionKey | null): CompareOption => {
    const diff = todayQuote.netOutflow.minus(q.netOutflow);
    const f = new FactBuilder<string>()
      .add("settlementDate", isoDate(q.date), "date", "computed", asOf)
      .add("instalmentsBefore", toMoneyString(q.scheduledPayments), "QAR", "finance_schedule", asOf)
      .add("settlementAmount", toMoneyString(q.settlementAmount), "QAR", "computed", asOf)
      .add("coverRefund", toMoneyString(q.coverRefund), "QAR", "computed", asOf)
      .add("totalOutflow", toMoneyString(q.netOutflow), "QAR", "computed", asOf)
      .add("savingVsToday", toMoneyString(max(diff, D(0))), "QAR", "computed", asOf)
      .add("extraVsToday", toMoneyString(max(diff.negated(), D(0))), "QAR", "computed", asOf);
    return { key, best: false, facts: f.build(), action };
  };

  const options: [CompareOption, ...CompareOption[]] = [option("today", todayQuote, "settle_now")];
  const seen = new Set([today.getTime()]);
  const candidates: [string, Date | null, OptionKey | null][] = [
    ["cheapest_date", cheapestDate, "schedule_settlement"],
    ["after_next_instalment", next, null],
  ];
  for (const [key, date, action] of candidates) {
    if (!date || seen.has(date.getTime()) || date > horizonEnd) continue;
    seen.add(date.getTime());
    options.push(option(key, quoteSettlement(input, params, today, date), action));
  }
  markBest(options, (o) => D(factValue(o, "totalOutflow")), "min");

  const summary = new FactBuilder<string>()
    .add("cheapestSettlementDate", ev.facts.cheapestSettlementDate.value, "date", "computed", asOf)
    .add(
      "savingIfSettledOnCheapestDate",
      ev.facts.savingIfSettledOnCheapestDate.value,
      "QAR",
      "computed",
      asOf,
    )
    .add("netOutflowToday", ev.facts.netOutflowToday.value, "QAR", "computed", asOf)
    .add("settlementHorizonDays", String(params.horizonDays), "days", "rule_pack", asOf)
    .build();
  return {
    scenario: "settlement_timing",
    applicable: input.finance.schedule.some((e) => !e.paid),
    summary,
    options,
  };
}

// ── min_vs_custom_payment ──────────────────────────────────────────────────────────────────────

/**
 * Paying only the minimum, a fixed higher amount (the customer's, or the pack's default multiple
 * of the minimum), or the full statement balance. The first two are exactly the
 * card.minimum_payment facts. Worked example: 1,000.00 at 24%, minimum max(5%, 100):
 * minimum 12 months / 102.16; 500 a month 3 months / 10.20; in full 1 month / 0.00.
 */
export function compareMinVsCustomPayment(
  input: MinimumPaymentInput,
  params: MinimumPaymentParams,
): Comparison {
  const asOf = isoDate(input.dataAsOf);
  const ev = evaluateMinimumPayment(input, params, NEUTRAL_THRESHOLDS);
  const balance = D(input.card.statementBalance);
  const full = amortiseRevolving(balance, {
    payment: () => balance,
    aprPct: D(input.card.aprPct),
    maxMonths: 1,
    mode: params.roundingMode,
  });
  const option = (
    key: string,
    payment: string,
    months: string,
    charges: string,
    paid: string,
    clears: string,
    action: OptionKey,
  ): CompareOption => ({
    key,
    best: false,
    action,
    facts: new FactBuilder<string>()
      .add("monthlyPayment", payment, "QAR", "computed", asOf)
      .add("monthsToClear", months, "months", "computed", asOf)
      .add("totalCharges", charges, "QAR", "computed", asOf)
      .add("totalPaid", paid, "QAR", "computed", asOf)
      .add("clearsBalance", clears, "boolean", "computed", asOf)
      .build(),
  });
  const v = (k: keyof typeof ev.facts) => (ev.facts[k] as { value: string }).value;
  const cmpPaid = balance.plus(D(v("totalInterestComparison")));
  const options: [CompareOption, ...CompareOption[]] = [
    option(
      "minimum",
      v("minimumDue"),
      v("monthsToClearMinimum"),
      v("totalInterestMinimum"),
      v("totalPaidMinimum"),
      v("minimumClearsBalance"),
      "continue_minimum_payment",
    ),
    option(
      "custom",
      v("comparisonPayment"),
      v("monthsToClearComparison"),
      v("totalInterestComparison"),
      toMoneyString(cmpPaid),
      "true",
      "pay_custom_amount",
    ),
    option(
      "full",
      toMoneyString(balance),
      String(full.months),
      toMoneyString(full.totalInterest),
      toMoneyString(full.totalPaid),
      String(full.clears),
      "pay_statement_balance",
    ),
  ];
  markBest(options, (o) => D(factValue(o, "totalCharges")), "min");
  const summary = new FactBuilder<string>()
    .add("statementBalance", v("statementBalance"), "QAR", "card", asOf)
    .add("minimumDue", v("minimumDue"), "QAR", "computed", asOf)
    .add("aprPct", v("aprPct"), "percent", "card", asOf)
    .add("totalInterestMinimum", v("totalInterestMinimum"), "QAR", "computed", asOf)
    .add("monthsToClearMinimum", v("monthsToClearMinimum"), "months", "computed", asOf)
    .build();
  return { scenario: "min_vs_custom_payment", applicable: ev.applicable, summary, options };
}

// ── deposit_break_vs_wait ──────────────────────────────────────────────────────────────────────

/** Break today or keep to maturity: exactly the deposit.break facts, side by side. */
export function compareDepositBreakVsWait(
  input: DepositBreakInput,
  params: DepositBreakParams,
  now: Date,
): Comparison {
  const asOf = isoDate(input.dataAsOf);
  const ev = evaluateDepositBreak(input, params, NEUTRAL_THRESHOLDS, now);
  const v = (k: keyof typeof ev.facts) => (ev.facts[k] as { value: string }).value;
  const option = (
    key: string,
    date: string,
    received: string,
    ret: string,
    penalty: string,
    action: OptionKey,
  ): CompareOption => ({
    key,
    best: false,
    action,
    facts: new FactBuilder<string>()
      .add("receiveDate", date, "date", "computed", asOf)
      .add("amountReceived", received, "QAR", "computed", asOf)
      .add("returnEarned", ret, "QAR", "computed", asOf)
      .add("penalty", penalty, "QAR", "deposit", asOf)
      .build(),
  });
  const options: [CompareOption, ...CompareOption[]] = [
    option(
      "break_today",
      isoDate(startOfUtcDay(now)),
      v("netReceivedNow"),
      v("profitIfBrokenToday"),
      v("breakPenalty"),
      "continue_break",
    ),
    option(
      "wait_to_maturity",
      v("maturityDate"),
      v("netAtMaturity"),
      v("profitAtMaturity"),
      "0.00",
      "keep_until_maturity",
    ),
  ];
  markBest(options, (o) => D(factValue(o, "amountReceived")), "max");
  const summary = new FactBuilder<string>()
    .add("daysToMaturity", v("daysToMaturity"), "days", "computed", asOf)
    .add("maturityDate", v("maturityDate"), "date", "deposit", asOf)
    .add("differenceIfKeptToMaturity", v("differenceIfKeptToMaturity"), "QAR", "computed", asOf)
    .build();
  return { scenario: "deposit_break_vs_wait", applicable: ev.applicable, summary, options };
}

const factValue = (o: CompareOption, key: string): string => (o.facts[key] as Fact).value;

/** Mark the single best option (ties: the first, which is the earliest / simplest). */
function markBest(
  options: [CompareOption, ...CompareOption[]],
  score: (o: CompareOption) => Dec,
  goal: "min" | "max",
): void {
  const better = (a: CompareOption, b: CompareOption) =>
    goal === "min" ? score(a).lessThan(score(b)) : score(a).greaterThan(score(b));
  options.reduce((best, o) => (better(o, best) ? o : best)).best = true;
}
