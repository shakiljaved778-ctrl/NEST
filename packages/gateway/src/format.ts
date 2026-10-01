import {
  type DigitStyle,
  formatDate,
  formatMoney,
  formatNumber,
  formatPercent,
  type Locale,
} from "@amil/i18n";
import type { Fact } from "@amil/rules-engine";

export interface DisplayOptions {
  locale: Locale;
  digitStyle: DigitStyle;
}

/**
 * Customer-facing display of a fact. This is the only way facts become text: templates, the
 * card's fact chips and the model's fact template all use it, so the number validator sees the
 * same strings the customer does.
 */
export function formatFact(fact: Fact, opts: DisplayOptions): string {
  switch (fact.unit) {
    case "QAR":
      return formatMoney(fact.value, opts);
    case "percent":
      return formatPercent(fact.value, opts);
    case "date":
      return fact.value ? formatDate(fact.value, opts) : "";
    case "points":
    case "count":
    case "days":
    case "months":
      return formatNumber(fact.value, opts);
    case "boolean":
    case "code":
      return fact.value;
  }
}
