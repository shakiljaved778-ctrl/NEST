import { formatDate, formatMoney, formatNumber, formatPercent, type Locale } from "@amil/i18n";
import type { AnyEvaluation, Fact, Severity } from "@amil/rules-engine";
import { describe, expect, it } from "vitest";
import { CARD_CLOSE_FACT_KEYS } from "./card-close/types";
import {
  emptyCard,
  fatimaFinance,
  financeThresholds,
  khalidCard,
  NOW,
  smallLoan,
  thresholds,
} from "./fixtures";
import { FINANCE_SETTLEMENT_FACT_KEYS } from "./finance-early-settlement/types";
import {
  ALL_PACK_DEFINITIONS,
  cardClosePacks,
  financeEarlySettlementPacks,
  variantForFinanceType,
} from "./registry";
import { renderTemplate, stripTemplateSyntax, templateFactKeys } from "./template";
import {
  copyPolicy,
  copyViolations,
  explain,
  explanationKey,
  factLabel,
  GENERIC_TEMPLATES,
  TEMPLATES,
} from "./templates";

const SEVERITIES: Severity[] = ["info", "caution", "critical"];
const LOCALES: Locale[] = ["en", "ar"];
const CONTINUE_OPTIONS = new Set(["continue_closure", "settle_now"]);

/** Formatter used for test rendering; Phase 3 wires the same i18n functions into the API. */
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

describe("pack definitions", () => {
  it("loads all four definitions with semver versions", () => {
    expect(ALL_PACK_DEFINITIONS.map((d) => `${d.key}@${d.version}/${d.variant}`)).toEqual([
      "card.close@1.0.0/conventional",
      "card.close@1.0.0/islamic",
      "finance.early_settlement@1.0.0/conventional",
      "finance.early_settlement@1.0.0/islamic",
    ]);
  });

  it("card.close declares exactly the facts the calculator emits", () => {
    for (const pack of Object.values(cardClosePacks)) {
      expect(pack.definition.facts.map((f) => f.key).sort()).toEqual(
        [...CARD_CLOSE_FACT_KEYS].sort(),
      );
      const ev = pack.evaluate(khalidCard(), pack.defaultParameters, thresholds, NOW);
      for (const [k, f] of Object.entries(ev.facts)) {
        if (k === "_sources") continue;
        const declared = pack.definition.facts.find((d) => d.key === k);
        expect(declared, k).toBeDefined();
        expect((f as Fact).unit).toBe(declared?.unit);
        expect((f as Fact).source).toBe(declared?.source);
      }
    }
  });

  it("finance.early_settlement emits only declared facts, with declared units and sources", () => {
    const cases = [
      [financeEarlySettlementPacks.islamic, fatimaFinance()],
      [
        financeEarlySettlementPacks.islamic,
        smallLoan({ type: "ijara", settlementFeeRule: { type: "none" } }),
      ],
      [financeEarlySettlementPacks.conventional, smallLoan()],
    ] as const;
    for (const [pack, input] of cases) {
      const ev = pack.evaluate(input, pack.defaultParameters, financeThresholds, NOW);
      for (const [k, f] of Object.entries(ev.facts)) {
        if (k === "_sources") continue;
        const declared = pack.definition.facts.find((d) => d.key === k);
        expect(declared, `${pack.variant}:${k}`).toBeDefined();
        expect((f as Fact).unit).toBe(declared?.unit);
      }
    }
    const allDeclared = new Set(
      ALL_PACK_DEFINITIONS.filter((d) => d.key === "finance.early_settlement").flatMap((d) =>
        d.facts.map((f) => f.key),
      ),
    );
    expect([...allDeclared].sort()).toEqual([...FINANCE_SETTLEMENT_FACT_KEYS].sort());
  });
});

describe("variantForFinanceType", () => {
  it.each([
    ["conventional", "conventional"],
    ["murabaha", "islamic"],
    ["ijara", "islamic"],
  ] as const)("%s -> %s", (type, variant) => {
    expect(variantForFinanceType(type)).toBe(variant);
  });
});

describe("template coverage", () => {
  it.each(
    ALL_PACK_DEFINITIONS.flatMap((d) =>
      LOCALES.flatMap((l) => SEVERITIES.map((s) => [d.key, d.variant, l, s] as const)),
    ),
  )("%s / %s / %s / %s has exactly one template", (key, variant, locale, severity) => {
    const matches = TEMPLATES.filter(
      (t) =>
        t.rulePackKey === key &&
        t.variant === variant &&
        t.locale === locale &&
        t.severity === severity,
    );
    expect(matches).toHaveLength(1);
  });
});

describe.each(TEMPLATES.map((t) => [`${t.key}/${t.locale}`, t] as const))(
  "template %s",
  (_name, t) => {
    const def = ALL_PACK_DEFINITIONS.find(
      (d) => d.key === t.rulePackKey && d.variant === t.variant,
    );

    it("references only facts declared by its pack", () => {
      const declared = new Set(def?.facts.map((f) => f.key));
      for (const text of [t.headline, t.body]) {
        const { sections, placeholders } = templateFactKeys(text);
        for (const key of [...sections, ...placeholders]) expect(declared.has(key), key).toBe(true);
      }
    });

    it("follows the copy policy (no selling, no exclamation marks or emojis, Sharia terminology)", () => {
      for (const text of [t.headline, t.body, ...t.options.map((o) => o.label)]) {
        expect(copyViolations(stripTemplateSyntax(text), t.locale, t.variant)).toEqual([]);
      }
    });

    it("orders options: loss-avoiding first, then continue, then talk to someone", () => {
      const keys = t.options.map((o) => o.key);
      expect(keys.at(-1)).toBe("talk_to_someone");
      expect(CONTINUE_OPTIONS.has(keys.at(-2) ?? "")).toBe(true);
    });

    it("has the same option keys as its other-locale twin", () => {
      const twin = TEMPLATES.find((o) => o.key === t.key && o.locale !== t.locale);
      expect(twin?.options.map((o) => o.key)).toEqual(t.options.map((o) => o.key));
    });
  },
);

describe("templates render cleanly against real evaluations", () => {
  const cardEvals: [string, AnyEvaluation][] = [
    [
      "khalid",
      cardClosePacks.conventional.evaluate(
        khalidCard(),
        cardClosePacks.conventional.defaultParameters,
        thresholds,
        NOW,
      ),
    ],
    [
      "balance only",
      cardClosePacks.conventional.evaluate(
        { ...emptyCard(), card: { ...emptyCard().card, balance: "120.00" } },
        cardClosePacks.conventional.defaultParameters,
        thresholds,
        NOW,
      ),
    ],
  ];
  const financeEvals: [string, "conventional" | "islamic", AnyEvaluation][] = [
    [
      "fatima",
      "islamic",
      financeEarlySettlementPacks.islamic.evaluate(
        fatimaFinance(),
        financeEarlySettlementPacks.islamic.defaultParameters,
        financeThresholds,
        NOW,
      ),
    ],
    [
      "ijara",
      "islamic",
      financeEarlySettlementPacks.islamic.evaluate(
        smallLoan({ type: "ijara", settlementFeeRule: { type: "none" } }),
        financeEarlySettlementPacks.islamic.defaultParameters,
        financeThresholds,
        new Date("2026-02-25T10:00:00Z"),
      ),
    ],
    [
      "small loan",
      "conventional",
      financeEarlySettlementPacks.conventional.evaluate(
        smallLoan({ salaryLinked: true }),
        financeEarlySettlementPacks.conventional.defaultParameters,
        financeThresholds,
        new Date("2026-02-25T10:00:00Z"),
      ),
    ],
  ];
  const cases = [
    ...cardEvals.flatMap(([name, ev]) =>
      (["conventional", "islamic"] as const).map((v) => [name, "card.close", v, ev] as const),
    ),
    ...financeEvals.map(([name, v, ev]) => [name, "finance.early_settlement", v, ev] as const),
  ];

  it.each(
    cases.flatMap(([name, pack, variant, ev]) =>
      LOCALES.map((locale) => [name, pack, variant, locale, ev] as const),
    ),
  )("%s (%s %s, %s)", (_name, pack, variant, locale, ev) => {
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
    expect(headline.missing).toEqual([]);
    expect(body.missing).toEqual([]);
    expect(headline.text.length).toBeGreaterThan(0);
    expect(headline.text.length).toBeLessThanOrEqual(copyPolicy.maxHeadlineChars);
    expect(body.text.length).toBeLessThanOrEqual(copyPolicy.maxBodyChars);
    expect(copyViolations(`${headline.text} ${body.text}`, locale, variant)).toEqual([]);
  });

  it("Khalid's English critical card reads as specified", () => {
    const [, ev] = cardEvals[0] ?? [];
    const t = TEMPLATES.find(
      (x) => x.key === "card.close.conventional.critical" && x.locale === "en",
    );
    if (!ev || !t) throw new Error("fixture");
    expect(renderTemplate(t.headline, ev.facts, formatter("en")).text).toBe(
      "Closing this card forfeits 42,000 points (about QAR 420.00)",
    );
    expect(renderTemplate(t.body, ev.facts, formatter("en")).text).toBe(
      "Your 42,000 reward points, worth about QAR 420.00, end when the card closes. Of these, 8,000 points were due to expire within 90 days. Your instalment plans become payable in full: QAR 3,672.00, including QAR 72.00 in early-closure fees. You are due a refund of QAR 1,250.00 from the annual fee. Supplementary cards on this card (1) close too. The balance to clear is QAR 6,250.00.",
    );
  });

  it("Fatima's Arabic critical card leads with the cheaper date", () => {
    const [, , ev] = financeEvals[0] ?? [];
    const t = TEMPLATES.find(
      (x) => x.key === "finance.early_settlement.islamic.critical" && x.locale === "ar",
    );
    if (!ev || !t) throw new Error("fixture");
    expect(renderTemplate(t.headline, ev.facts, formatter("ar")).text).toBe(
      "السداد في 19 أكتوبر 2026 بدلاً من اليوم يقلّل ما تدفعه بمقدار 4,000.00 ر.ق",
    );
  });
});

describe("copy policy (adversarial)", () => {
  it.each([
    ["Special offer for you", "en", "conventional", ["banned_term:offer"]],
    ["Apply now to settle", "en", "conventional", ["banned_term:apply now"]],
    ["A SPECIAL RATE is available", "en", "conventional", ["banned_term:special rate"]],
    ["Settle today!", "en", "conventional", ["exclamation_mark"]],
    ["Great news 🎉", "en", "conventional", ["emoji"]],
    [
      "Your loan interest",
      "en",
      "islamic",
      ["conventional_term_in_islamic_copy:interest", "conventional_term_in_islamic_copy:loan"],
    ],
    ["لدينا عرض خاص لك", "ar", "conventional", ["banned_term:عرض خاص"]],
    ["قدّم الآن", "ar", "conventional", ["banned_term:قدّم الآن"]],
    [
      "الفائدة المستحقة",
      "ar",
      "islamic",
      ["conventional_term_in_islamic_copy:فائدة", "conventional_term_in_islamic_copy:الفائدة"],
    ],
  ] as const)("%j (%s, %s) -> %j", (text, locale, variant, expected) => {
    expect(copyViolations(text, locale, variant)).toEqual(expected);
  });

  it.each([
    ["The bank offered no fee waiver", "en"], // 'offered' is not the banned whole word 'offer'
    ["Interest accrued to date", "en"], // fine in conventional copy
    ["عرض خطط التقسيط", "ar"], // 'view instalment plans': عرض alone is allowed
  ] as const)("does not flag %j", (text, locale) => {
    expect(copyViolations(text, locale, "conventional")).toEqual([]);
  });
});

describe("generic (no-consent) templates", () => {
  it.each(ALL_PACK_DEFINITIONS.flatMap((d) => LOCALES.map((l) => [d.key, d.variant, l] as const)))(
    "%s / %s / %s exists, has no placeholders and follows policy",
    (key, variant, locale) => {
      const matches = GENERIC_TEMPLATES.filter(
        (t) => t.rulePackKey === key && t.variant === variant && t.locale === locale,
      );
      expect(matches).toHaveLength(1);
      const t = matches[0];
      if (!t) return;
      for (const text of [t.headline, t.body]) {
        expect(templateFactKeys(text)).toEqual({ sections: [], placeholders: [] });
        expect(copyViolations(text, locale, variant)).toEqual([]);
      }
      expect(t.options.at(-1)?.key).toBe("talk_to_someone");
    },
  );
});

describe("fact labels and explanations", () => {
  it.each(
    ALL_PACK_DEFINITIONS.flatMap((d) => LOCALES.map((l) => [d.key, d.variant, l, d] as const)),
  )("%s / %s: every declared fact has a %s label", (key, _v, locale, def) => {
    for (const f of def.facts) expect(factLabel(key, locale, f.key), f.key).not.toBe(f.key);
  });

  it("every explanation code the calculators emit has approved copy in both locales", () => {
    const evaluations = [
      [
        "card.close",
        cardClosePacks.conventional.evaluate(
          khalidCard(),
          cardClosePacks.conventional.defaultParameters,
          thresholds,
          NOW,
        ),
      ],
      [
        "card.close",
        cardClosePacks.conventional.evaluate(
          {
            ...emptyCard(),
            rewards: {
              balance: 0,
              pointValueQar: "0.01",
              expiryBuckets: [],
              pendingCashback: "60.00",
              asOf: NOW,
            },
          },
          cardClosePacks.conventional.defaultParameters,
          thresholds,
          NOW,
        ),
      ],
      [
        "finance.early_settlement",
        financeEarlySettlementPacks.islamic.evaluate(
          fatimaFinance({ salaryLinked: true }),
          financeEarlySettlementPacks.islamic.defaultParameters,
          financeThresholds,
          NOW,
        ),
      ],
      [
        "finance.early_settlement",
        financeEarlySettlementPacks.conventional.evaluate(
          smallLoan(),
          financeEarlySettlementPacks.conventional.defaultParameters,
          { cautionAtQar: "0.00", criticalAtQar: "999999" },
          new Date("2026-02-25T10:00:00Z"),
        ),
      ],
    ] as const;
    for (const [pack, ev] of evaluations) {
      const codes = ev.explanation
        .map(explanationKey)
        .filter((k): k is string => k !== null && k !== "severity_info");
      for (const locale of LOCALES)
        expect(explain(pack, locale, ev.explanation), `${pack}/${locale}`).toHaveLength(
          codes.length,
        );
    }
  });

  it("normalises explanation codes", () => {
    expect(explanationKey("points_expiring_within_90_days")).toBe("points_expiring_within_N_days");
    expect(explanationKey("severity:critical")).toBe("severity_critical");
    expect(explanationKey("severity_basis_qar:492.00")).toBeNull();
  });

  it("explanations and labels follow the copy policy", () => {
    for (const pack of ["card.close", "finance.early_settlement"])
      for (const locale of LOCALES) {
        const all = [...explain(pack, locale, ["severity:critical", "severity:caution"])];
        for (const s of all) expect(copyViolations(s, locale, "conventional")).toEqual([]);
      }
  });
});
