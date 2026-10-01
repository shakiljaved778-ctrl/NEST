/**
 * Phase 5 packs: declared facts match what the calculators emit, every approved template renders
 * cleanly against real evaluations (no missing placeholders, within length limits, within copy
 * policy), and every explanation code has approved copy.
 */
import { formatDate, formatMoney, formatNumber, formatPercent, type Locale } from "@amil/i18n";
import type { AnyEvaluation, Fact } from "@amil/rules-engine";
import { describe, expect, it } from "vitest";
import {
  accountClose,
  aishaDeposit,
  balanceTransfer,
  cashWithdrawal,
  dormancy,
  eppConversion,
  fatimaFinance,
  financeThresholds,
  minimumPayment,
  NOW,
  rewardsExpiry,
  salaryChange,
  thresholds,
  topUp,
} from "./fixtures";
import { getPack, type PackKey } from "./registry";
import { renderTemplate } from "./template";
import { copyPolicy, copyViolations, explain, explanationKey, TEMPLATES } from "./templates";

const LOCALES: Locale[] = ["en", "ar"];
const FEB = new Date("2026-02-25T10:00:00Z");
const strict = { cautionAtQar: "0.01", criticalAtQar: "1.00" };
const lax = { cautionAtQar: "999999.00", criticalAtQar: "9999999.00" };

const formatter = (locale: Locale) => (f: Fact) => {
  const opts = { locale, digitStyle: "latn" as const };
  switch (f.unit) {
    case "QAR":
      return formatMoney(f.value, opts);
    case "percent":
      return formatPercent(f.value, opts);
    case "date":
      return formatDate(f.value, opts);
    case "points":
    case "count":
    case "days":
    case "months":
      return formatNumber(f.value, opts);
    default:
      return f.value;
  }
};

type Case = [name: string, pack: PackKey, input: unknown, t: typeof thresholds, now: Date];
const CASES: Case[] = [
  ["top-up extends", "finance.top_up", topUp(), financeThresholds, FEB],
  ["top-up same tenor", "finance.top_up", topUp({ newTenorMonths: 2 }), lax, FEB],
  [
    "top-up murabaha",
    "finance.top_up",
    { ...fatimaFinance(), topUpAmount: "20000.00", newTenorMonths: 60 },
    financeThresholds,
    NOW,
  ],
  ["cash 1,000", "card.cash_withdrawal", cashWithdrawal(), thresholds, NOW],
  ["cash above limit", "card.cash_withdrawal", cashWithdrawal({ amount: "9500.00" }), strict, NOW],
  ["cash small", "card.cash_withdrawal", cashWithdrawal({ amount: "100.00" }), lax, NOW],
  ["minimum", "card.minimum_payment", minimumPayment(), thresholds, NOW],
  [
    "minimum large",
    "card.minimum_payment",
    minimumPayment({
      card: { ...minimumPayment().card, statementBalance: "18450.75", minDue: "922.54" },
    }),
    thresholds,
    NOW,
  ],
  ["minimum info", "card.minimum_payment", minimumPayment(), lax, NOW],
  ["epp", "card.epp_conversion", eppConversion(), thresholds, NOW],
  ["epp critical", "card.epp_conversion", eppConversion(), strict, NOW],
  ["epp info", "card.epp_conversion", eppConversion(), lax, NOW],
  ["transfer", "card.balance_transfer", balanceTransfer({ amount: "15000.00" }), thresholds, NOW],
  ["transfer info", "card.balance_transfer", balanceTransfer(), lax, NOW],
  ["deposit Aisha", "deposit.break", aishaDeposit(), financeThresholds, NOW],
  [
    "deposit no penalty",
    "deposit.break",
    aishaDeposit({ breakPenaltyRule: { type: "none" }, profitOnBreakRule: { type: "none" } }),
    lax,
    NOW,
  ],
  ["salary", "salary.transfer_change", salaryChange(), thresholds, NOW],
  [
    "salary waivers only",
    "salary.transfer_change",
    salaryChange({ finances: [] }),
    thresholds,
    NOW,
  ],
  ["salary info", "salary.transfer_change", salaryChange(), lax, NOW],
  ["account Hessa", "account.close", accountClose(), thresholds, NOW],
  ["account caution", "account.close", accountClose({ chequesOutstanding: 0 }), thresholds, NOW],
  [
    "account info",
    "account.close",
    accountClose(
      { chequesOutstanding: 0, isSalaryAccount: false, standingOrders: [] },
      { linkedCards: 0 },
    ),
    thresholds,
    NOW,
  ],
  [
    "account salary-linked",
    "account.close",
    accountClose({ chequesOutstanding: 0, standingOrders: [] }, { salaryLinkedFinances: 2 }),
    thresholds,
    NOW,
  ],
  ["dormancy critical", "account.dormancy", dormancy(340), thresholds, NOW],
  ["dormancy caution", "account.dormancy", dormancy(320), thresholds, NOW],
  ["rewards", "rewards.expiry", rewardsExpiry(), thresholds, NOW],
  ["rewards info", "rewards.expiry", rewardsExpiry(), lax, NOW],
  [
    "rewards soon",
    "rewards.expiry",
    rewardsExpiry({ expiryBuckets: [{ points: 30000, expiresAt: "2026-10-10" }] }),
    thresholds,
    NOW,
  ],
];

const evaluate = (
  [, pack, input, t, now]: Case,
  variant: "conventional" | "islamic",
): AnyEvaluation => {
  const p = getPack(pack, variant);
  return p.evaluate(input as never, p.defaultParameters, t, now);
};

describe.each(CASES)("%s (%s)", (...c) => {
  const [, pack] = c;

  it("emits exactly the declared facts, with declared units and sources", () => {
    for (const variant of ["conventional", "islamic"] as const) {
      const def = getPack(pack, variant).definition;
      const ev = evaluate(c, variant);
      const keys = Object.keys(ev.facts).filter((k) => k !== "_sources");
      expect(keys.sort()).toEqual(def.facts.map((f) => f.key).sort());
      for (const d of def.facts) {
        const f = ev.facts[d.key] as Fact;
        expect([f.unit, f.source], d.key).toEqual([d.unit, d.source]);
      }
    }
  });

  it.each(
    (["conventional", "islamic"] as const).flatMap((v) => LOCALES.map((l) => [v, l] as const)),
  )("renders the approved %s/%s template cleanly", (variant, locale) => {
    const ev = evaluate(c, variant);
    const t = TEMPLATES.find(
      (x) =>
        x.rulePackKey === pack &&
        x.variant === variant &&
        x.locale === locale &&
        x.severity === ev.severity,
    );
    if (!t) throw new Error("template missing");
    const headline = renderTemplate(t.headline, ev.facts, formatter(locale));
    const body = renderTemplate(t.body, ev.facts, formatter(locale));
    expect([...headline.missing, ...body.missing]).toEqual([]);
    expect(headline.text.length).toBeGreaterThan(0);
    expect(headline.text.length, headline.text).toBeLessThanOrEqual(copyPolicy.maxHeadlineChars);
    expect(body.text.length).toBeLessThanOrEqual(copyPolicy.maxBodyChars);
    expect(body.text).not.toMatch(/\{|\}|\[\[|\]\]/);
    expect(copyViolations(`${headline.text} ${body.text}`, locale, variant)).toEqual([]);
    // Every option the evaluation offers has an approved label.
    for (const o of ev.options) expect(t.options.map((x) => x.key)).toContain(o);
  });

  it("has approved 'why' copy for every explanation code", () => {
    const ev = evaluate(c, "conventional");
    const codes = ev.explanation
      .map(explanationKey)
      .filter((k) => k !== null && k !== "severity_info");
    for (const locale of LOCALES)
      expect(explain(pack, locale, ev.explanation)).toHaveLength(codes.length);
  });
});

describe("worked copy", () => {
  it("Aisha's English critical card", () => {
    const ev = evaluate(CASES[14] as Case, "conventional");
    const t = TEMPLATES.find(
      (x) => x.key === "deposit.break.conventional.critical" && x.locale === "en",
    );
    if (!t) throw new Error("template");
    expect(renderTemplate(t.headline, ev.facts, formatter("en")).text).toBe(
      "Keeping this deposit 9 more days pays QAR 9,012.33 more",
    );
    expect(renderTemplate(t.body, ev.facts, formatter("en")).text).toBe(
      "Breaking it today pays QAR 199,487.67, after a break penalty of QAR 1,000.00 and including QAR 487.67 in interest at the reduced rate. At maturity on 9 Oct 2026 you would receive QAR 208,500.00, including QAR 8,500.00 in interest at 4.25%. Breaking now gives up QAR 7,802.74 of the interest earned so far.",
    );
  });

  it("Khalid's Arabic rewards alert", () => {
    const ev = evaluate(CASES[25] as Case, "conventional");
    const t = TEMPLATES.find(
      (x) => x.key === "rewards.expiry.conventional.caution" && x.locale === "ar",
    );
    if (!t) throw new Error("template");
    expect(renderTemplate(t.headline, ev.facts, formatter("ar")).text).toBe(
      "تنتهي صلاحية 8,000 نقطة بقيمة 80.00 ر.ق في 14 نوفمبر 2026",
    );
  });
});
