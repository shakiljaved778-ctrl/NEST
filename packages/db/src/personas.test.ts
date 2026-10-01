/**
 * Phase 2 acceptance: Khalid and Fatima, evaluated from the actual seed rows through the
 * adapters and the registered packs, match the expected facts exactly.
 */
import {
  cardClosePacks,
  financeEarlySettlementPacks,
  renderTemplate,
  TEMPLATES,
  variantForFinanceType,
} from "@amil/rule-packs";
import type { AnyEvaluation, Fact } from "@amil/rules-engine";
import { describe, expect, it } from "vitest";
import { thresholdsFor, toCardCloseInput, toFinanceSettlementInput } from "./adapters";
import { buildSeedData } from "./seed/build";

const NOW = new Date("2026-09-30T09:00:00Z");
const data = buildSeedData(NOW);
const thresholds = (key: string) => thresholdsFor(data.bank.severityThresholds, key);

function evaluateCardClose(cardId: string) {
  const card = data.cards.find((c) => c.id === cardId);
  if (!card) throw new Error(cardId);
  const input = toCardCloseInput(
    card,
    data.rewardsLedgers.find((r) => r.cardId === cardId),
    data.instalmentPlans.filter((p) => p.cardId === cardId),
    NOW,
  );
  const pack = cardClosePacks[card.type];
  return pack.evaluate(input, pack.defaultParameters, thresholds("card.close"), NOW);
}

function evaluateSettlement(financeId: string) {
  const fin = data.finances.find((f) => f.id === financeId);
  if (!fin) throw new Error(financeId);
  const pack = financeEarlySettlementPacks[variantForFinanceType(fin.type)];
  return pack.evaluate(
    toFinanceSettlementInput(fin, NOW),
    pack.defaultParameters,
    thresholds("finance.early_settlement"),
    NOW,
  );
}

const valuesOf = (ev: AnyEvaluation) =>
  Object.fromEntries(
    Object.entries(ev.facts)
      .filter(([k]) => k !== "_sources")
      .map(([k, f]) => [k, (f as Fact).value]),
  );

describe("Khalid closes his Platinum card", () => {
  const ev = evaluateCardClose("card_khalid_platinum");

  it("matches the expected facts exactly", () => {
    expect(valuesOf(ev)).toEqual({
      pointsBalance: "42000",
      pointValueQar: "0.0100",
      pointsValue: "420.00",
      pointsExpiringSoon: "8000",
      pointsExpiringSoonValue: "80.00",
      nextPointsExpiryDate: "2026-11-14",
      pointsExpiryWindowDays: "90",
      pendingCashback: "0.00",
      pendingCashbackForfeited: "0.00",
      forfeitedValue: "420.00",
      activeInstalmentPlans: "1",
      instalmentsRemainingPrincipal: "3600.00",
      instalmentEarlyClosureFees: "72.00",
      instalmentsPayableOnClosure: "3672.00",
      annualFee: "1500.00",
      annualFeeRefundEligible: "true",
      annualFeeMonthsUsed: "2",
      annualFeeRefund: "1250.00",
      supplementaryCards: "1",
      outstandingBalance: "6250.00",
      netAmountToClear: "8672.00",
      avoidableLoss: "492.00",
    });
  });

  it("is critical with redeem points offered first", () => {
    expect(ev.severity).toBe("critical");
    expect(ev.options[0]).toBe("redeem_points");
  });
});

describe("Fatima settles her murabaha early", () => {
  const ev = evaluateSettlement("fin_fatima_murabaha");

  it("matches the expected facts exactly, with the cheaper date in 19 days", () => {
    expect(valuesOf(ev)).toEqual({
      financeType: "murabaha",
      settlementAmountToday: "101287.50",
      deferredPriceOutstanding: "110075.00",
      deferredProfitNotYetDue: "17575.00",
      ibraRebatePct: "50.00",
      ibraRebate: "8787.50",
      settlementFee: "0.00",
      arrearsAmount: "0.00",
      coverKind: "takaful",
      coverRefundToday: "1387.50",
      netOutflowToday: "99900.00",
      nextInstalmentDate: "2026-10-19",
      nextInstalmentAmount: "2975.00",
      settlementHorizonDays: "60",
      cheapestSettlementDate: "2026-10-19",
      daysToCheapestDate: "19",
      instalmentsBeforeCheapestDate: "1",
      instalmentsAmountBeforeCheapestDate: "2975.00",
      netOutflowOnCheapestDate: "95900.00",
      savingIfSettledOnCheapestDate: "4000.00",
      salaryLinked: "false",
    });
  });

  it("is critical with 'schedule settlement' offered first", () => {
    expect(ev.severity).toBe("critical");
    expect(ev.options[0]).toBe("schedule_settlement");
  });
});

describe("every seeded card and finance evaluates and renders with approved copy", () => {
  const fmt = (f: Fact) => f.value;
  const render = (packKey: string, variant: string, ev: AnyEvaluation) => {
    for (const locale of ["en", "ar"] as const) {
      const t = TEMPLATES.find(
        (x) =>
          x.rulePackKey === packKey &&
          x.variant === variant &&
          x.locale === locale &&
          x.severity === ev.severity,
      );
      expect(t, `${packKey}/${variant}/${locale}/${ev.severity}`).toBeDefined();
      if (!t) continue;
      expect(renderTemplate(t.headline, ev.facts, fmt).missing).toEqual([]);
      expect(renderTemplate(t.body, ev.facts, fmt).missing).toEqual([]);
    }
  };

  it.each(data.cards.map((c) => [c.id, c.type] as const))("card.close %s (%s)", (id, type) => {
    render("card.close", type, evaluateCardClose(id));
  });

  it.each(data.finances.map((f) => [f.id, f.type] as const))(
    "finance.early_settlement %s (%s)",
    (id, type) => {
      const ev = evaluateSettlement(id);
      expect(ev.applicable).toBe(true);
      render("finance.early_settlement", variantForFinanceType(type), ev);
    },
  );

  it("Omar's salary-linked loan is at least caution", () => {
    expect(["caution", "critical"]).toContain(evaluateSettlement("fin_omar_personal").severity);
  });
});

describe("seeded rule packs and templates", () => {
  it("seeds both flagship packs in both variants, enabled", () => {
    expect(data.rulePacks.map((p) => `${p.key}/${p.variant}`).sort()).toEqual([
      "card.close/conventional",
      "card.close/islamic",
      "finance.early_settlement/conventional",
      "finance.early_settlement/islamic",
    ]);
    expect(data.rulePacks.every((p) => p.enabled && p.status === "active")).toBe(true);
  });

  it("seeds 24 templates; Islamic ones are sharia_approved (non-negotiable 8)", () => {
    expect(data.templates).toHaveLength(24);
    for (const t of data.templates) {
      expect(t.status).toBe(t.variant === "islamic" ? "sharia_approved" : "approved");
      expect(t.approvedBy).toBeTruthy();
    }
  });
});

describe("thresholdsFor", () => {
  it("falls back to the bank default", () => {
    expect(thresholdsFor(data.bank.severityThresholds, "rewards.expiry")).toEqual({
      cautionAtQar: "50.00",
      criticalAtQar: "250.00",
    });
  });
  it("throws without a default", () => {
    expect(() => thresholdsFor({}, "x")).toThrow(/No severity thresholds/);
  });
});
