import {
  addDays,
  clamp,
  D,
  daysBetween,
  type Dec,
  type Evaluation,
  FactBuilder,
  isoDate,
  maxSeverity,
  type OptionKey,
  percentOf,
  proRata,
  round,
  type SeverityThresholds,
  severityForAmount,
  startOfUtcDay,
  sum,
  toFixedString,
  toMoneyString,
} from "@amil/rules-engine";
import type { RebateRule, ScheduleEntry, SettlementFeeRule } from "../rules";
import type {
  FinanceSettlementFactKey,
  FinanceSettlementInput,
  FinanceSettlementParams,
} from "./types";

/** A full settlement quote if the customer settles on `date`. */
export interface SettlementQuote {
  date: Date;
  /** Unpaid instalments falling due from today up to and including `date` (paid as scheduled). */
  scheduledPayments: Dec;
  scheduledCount: number;
  /** Instalments paid by `date` (already paid + scheduled). Drives ibra tiers and cover refunds. */
  instalmentsPaidByDate: number;
  /** Unpaid instalments that were due before today. They are owed in full on settlement. */
  arrears: Dec;
  principalOutstanding: Dec;
  accruedCharge: Dec;
  deferredPrice: Dec;
  deferredProfit: Dec;
  rebatePct: Dec;
  rebate: Dec;
  futureProfitNotCharged: Dec;
  fee: Dec;
  settlementAmount: Dec;
  coverRefund: Dec;
  /** Everything the customer pays from today to `date` to be fully settled, minus cover refund. */
  netOutflow: Dec;
}

const dueDate = (e: ScheduleEntry): Date => new Date(`${e.dueAt}T00:00:00.000Z`);

/**
 * Quote for settling on `date` (UTC day). Assumes instalments due before then are paid on
 * schedule, which is the only assumption the bank's own schedule supports.
 *
 * - conventional and ijara: principal of instalments not yet due, plus interest (or rental
 *   profit) accrued actual/basis since the last due date, plus arrears and the settlement fee.
 * - murabaha: remaining sale price (instalments not yet due), less ibra on the deferred profit
 *   not yet due at the tier reached by `date`, plus arrears and the settlement fee.
 */
export function quoteSettlement(
  input: FinanceSettlementInput,
  params: FinanceSettlementParams,
  today: Date,
  date: Date,
): SettlementQuote {
  const { finance } = input;
  const mode = params.roundingMode;
  const entries = [...finance.schedule].sort((a, b) => a.n - b.n);

  const arrearsEntries = entries.filter((e) => !e.paid && dueDate(e) < today);
  const scheduled = entries.filter((e) => !e.paid && dueDate(e) >= today && dueDate(e) <= date);
  const remaining = entries.filter((e) => dueDate(e) > date);
  const paidByDate = entries.filter((e) => e.paid).length + scheduled.length;

  const arrears = sum(arrearsEntries.map((e) => D(e.instalment)));
  const scheduledPayments = sum(scheduled.map((e) => D(e.instalment)));
  const principalOutstanding = sum(remaining.map((e) => D(e.principal)));
  const futureCharge = sum(remaining.map((e) => D(e.profitOrInterest)));

  let accruedCharge = D(0);
  let deferredPrice = D(0);
  let deferredProfit = D(0);
  let rebatePct = D(0);
  let rebate = D(0);
  let futureProfitNotCharged = D(0);
  let base: Dec;

  if (finance.type === "murabaha") {
    deferredPrice = sum(remaining.map((e) => D(e.instalment)));
    deferredProfit = futureCharge;
    rebatePct = ibraPct(finance.rebateRule, paidByDate);
    rebate = round(percentOf(deferredProfit, rebatePct), mode);
    base = deferredPrice.minus(rebate);
  } else {
    // Entries are sorted by instalment number, so the last one due is the latest due date.
    const lastEntry = entries.filter((e) => dueDate(e) <= date).at(-1);
    const lastDue = lastEntry ? dueDate(lastEntry) : startOfUtcDay(finance.startAt);
    const days = Math.max(0, daysBetween(lastDue, date));
    accruedCharge = round(
      principalOutstanding
        .times(D(finance.ratePct))
        .dividedBy(100)
        .times(days)
        .dividedBy(params.dayCountBasis),
      mode,
    );
    if (finance.type === "ijara") futureProfitNotCharged = futureCharge;
    base = principalOutstanding.plus(accruedCharge);
  }

  const feeBase = finance.type === "murabaha" ? base : principalOutstanding;
  const fee =
    remaining.length === 0 ? D(0) : settlementFee(feeBase, finance.settlementFeeRule, params);
  const settlementAmount = base.plus(arrears).plus(fee);
  const coverRefund = coverRefundFor(input, params, paidByDate);
  const netOutflow = scheduledPayments.plus(settlementAmount).minus(coverRefund);

  return {
    date,
    scheduledPayments,
    scheduledCount: scheduled.length,
    instalmentsPaidByDate: paidByDate,
    arrears,
    principalOutstanding,
    accruedCharge,
    deferredPrice,
    deferredProfit,
    rebatePct,
    rebate,
    futureProfitNotCharged,
    fee,
    settlementAmount,
    coverRefund,
    netOutflow,
  };
}

/** Ibra percentage for the highest tier reached. Tiers are matched on instalments paid. */
export function ibraPct(rule: RebateRule | null, monthsElapsed: number): Dec {
  if (!rule || rule.type !== "ibra_tiers") return D(0);
  const reached = rule.tiers
    .filter((t) => t.minMonthsElapsed <= monthsElapsed)
    .sort((a, b) => b.minMonthsElapsed - a.minMonthsElapsed)[0];
  return reached ? D(reached.pct) : D(0);
}

function settlementFee(base: Dec, rule: SettlementFeeRule, params: FinanceSettlementParams): Dec {
  switch (rule.type) {
    case "none":
      return D(0);
    case "fixed":
      return D(rule.amount);
    case "pct_of_outstanding":
      return round(
        clamp(
          percentOf(base, D(rule.pct)),
          rule.floor ? D(rule.floor) : undefined,
          rule.cap ? D(rule.cap) : undefined,
        ),
        params.roundingMode,
      );
  }
}

function coverRefundFor(
  input: FinanceSettlementInput,
  params: FinanceSettlementParams,
  paidByDate: number,
): Dec {
  const cover = input.finance.cover;
  if (!cover || cover.refundRule.type === "none") return D(0);
  const months = D(cover.coverMonths);
  const unexpired = months.minus(paidByDate);
  if (unexpired.lessThanOrEqualTo(0)) return D(0);
  return round(proRata(D(cover.premiumPaid), unexpired, months), params.roundingMode);
}

/**
 * finance.early_settlement: the settlement amount today and the cheapest settlement date in the
 * next `horizonDays` days.
 *
 * Worked example (Fatima, murabaha, now 2026-09-30, 11 of 48 instalments of 2,975.00 paid,
 * profit 475.00 per instalment, ibra 50% before 12 paid / 75% from 12, takaful 1,800 over 48):
 *   today:      deferred price 37 x 2,975 = 110,075.00; deferred profit 37 x 475 = 17,575.00
 *               ibra 50% = 8,787.50 -> settlement 101,287.50
 *               takaful refund 1,800 x 37/48 = 1,387.50 -> net outflow 99,900.00
 *   2026-10-19: pay instalment 12 (2,975.00); deferred price 36 x 2,975 = 107,100.00
 *               ibra 75% of 36 x 475 = 12,825.00 -> settlement 94,275.00
 *               takaful refund 1,800 x 36/48 = 1,350.00
 *               net outflow 2,975 + 94,275 - 1,350 = 95,900.00 -> saving 4,000.00
 */
export function evaluateFinanceEarlySettlement(
  input: FinanceSettlementInput,
  params: FinanceSettlementParams,
  thresholds: SeverityThresholds,
  now: Date,
): Evaluation<FinanceSettlementFactKey> {
  const { finance } = input;
  const today = startOfUtcDay(now);
  const asOf = isoDate(input.dataAsOf);
  const f = new FactBuilder<FinanceSettlementFactKey>();
  const explanation: string[] = [];

  const todayQuote = quoteSettlement(input, params, today, today);
  const quotes: SettlementQuote[] = [todayQuote];
  for (let d = 1; d <= params.horizonDays; d++) {
    quotes.push(quoteSettlement(input, params, today, addDays(today, d)));
  }
  // Earliest date with the minimum net outflow.
  const cheapest = quotes.reduce((best, q) => (q.netOutflow.lessThan(best.netOutflow) ? q : best));
  const saving = todayQuote.netOutflow.minus(cheapest.netOutflow);
  const daysToCheapest = daysBetween(today, cheapest.date);

  const next = [...finance.schedule]
    .sort((a, b) => a.n - b.n)
    .find((e) => !e.paid && dueDate(e) >= today);

  f.add("financeType", finance.type, "code", "finance", asOf).add(
    "settlementAmountToday",
    toMoneyString(todayQuote.settlementAmount),
    "QAR",
    "computed",
    asOf,
  );
  if (finance.type === "murabaha") {
    f.add(
      "deferredPriceOutstanding",
      toMoneyString(todayQuote.deferredPrice),
      "QAR",
      "finance_schedule",
      asOf,
    )
      .add(
        "deferredProfitNotYetDue",
        toMoneyString(todayQuote.deferredProfit),
        "QAR",
        "finance_schedule",
        asOf,
      )
      .add("ibraRebatePct", toFixedString(todayQuote.rebatePct, 2), "percent", "finance", asOf)
      .add("ibraRebate", toMoneyString(todayQuote.rebate), "QAR", "computed", asOf);
  } else {
    f.add(
      "outstandingPrincipal",
      toMoneyString(todayQuote.principalOutstanding),
      "QAR",
      "finance_schedule",
      asOf,
    );
    if (finance.type === "conventional") {
      f.add("accruedInterest", toMoneyString(todayQuote.accruedCharge), "QAR", "computed", asOf);
    } else {
      f.add("accruedProfit", toMoneyString(todayQuote.accruedCharge), "QAR", "computed", asOf).add(
        "futureProfitNotCharged",
        toMoneyString(todayQuote.futureProfitNotCharged),
        "QAR",
        "finance_schedule",
        asOf,
      );
    }
  }
  f.add("settlementFee", toMoneyString(todayQuote.fee), "QAR", "computed", asOf);
  if (finance.settlementFeeRule.type === "pct_of_outstanding") {
    f.add("settlementFeePct", finance.settlementFeeRule.pct, "percent", "finance", asOf);
  }
  f.add("arrearsAmount", toMoneyString(todayQuote.arrears), "QAR", "finance_schedule", asOf);
  if (finance.cover) {
    f.add("coverKind", finance.cover.kind, "code", "finance", asOf).add(
      "coverRefundToday",
      toMoneyString(todayQuote.coverRefund),
      "QAR",
      "computed",
      asOf,
    );
  }
  f.add("netOutflowToday", toMoneyString(todayQuote.netOutflow), "QAR", "computed", asOf)
    .add("nextInstalmentDate", next?.dueAt ?? "", "date", "finance_schedule", asOf)
    .add(
      "nextInstalmentAmount",
      toMoneyString(D(next?.instalment ?? "0")),
      "QAR",
      "finance_schedule",
      asOf,
    )
    .add("settlementHorizonDays", String(params.horizonDays), "days", "rule_pack", asOf)
    .add("cheapestSettlementDate", isoDate(cheapest.date), "date", "computed", asOf)
    .add("daysToCheapestDate", String(daysToCheapest), "days", "computed", asOf)
    .add(
      "instalmentsBeforeCheapestDate",
      String(cheapest.scheduledCount),
      "count",
      "finance_schedule",
      asOf,
    )
    .add(
      "instalmentsAmountBeforeCheapestDate",
      toMoneyString(cheapest.scheduledPayments),
      "QAR",
      "finance_schedule",
      asOf,
    )
    .add("netOutflowOnCheapestDate", toMoneyString(cheapest.netOutflow), "QAR", "computed", asOf)
    .add("savingIfSettledOnCheapestDate", toMoneyString(saving), "QAR", "computed", asOf)
    .add("salaryLinked", String(finance.salaryLinked), "boolean", "finance", asOf);

  if (saving.greaterThan(0))
    explanation.push(`cheaper_settlement_date_within_${params.horizonDays}_days`);
  if (finance.type === "murabaha" && cheapest.rebatePct.greaterThan(todayQuote.rebatePct)) {
    explanation.push("ibra_tier_increases_before_cheapest_date");
  }
  if (todayQuote.fee.greaterThan(0)) explanation.push("settlement_fee_applies");
  if (finance.cover && todayQuote.coverRefund.greaterThan(0)) {
    explanation.push(`${finance.cover.kind}_refund_due`);
  }
  if (todayQuote.arrears.greaterThan(0)) explanation.push("arrears_included_in_settlement");
  if (finance.salaryLinked) explanation.push("salary_linked_benefits_may_change");

  // Severity: the avoidable cost of settling today rather than on the cheapest date (D-012);
  // salary-linked finance is at least "caution".
  const severity = maxSeverity(
    severityForAmount(saving, thresholds),
    finance.salaryLinked ? "caution" : "info",
  );
  explanation.push(`severity_basis_qar:${toMoneyString(saving)}`, `severity:${severity}`);

  const applicable = todayQuote.settlementAmount.greaterThan(0);
  const options: OptionKey[] = [];
  if (saving.greaterThan(0)) options.push("schedule_settlement");
  if (params.partialPrepaymentAllowed) options.push("partial_prepayment");
  options.push("settle_now", "talk_to_someone");

  return { applicable, severity, facts: f.build(), options, explanation };
}
