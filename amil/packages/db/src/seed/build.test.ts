import { D, daysBetween, toMoneyString } from "@amil/rules-engine";
import { describe, expect, it } from "vitest";
import { buildSchedule, buildSeedData, isLuhnValid, minimumDue, NAMED_PERSONAS } from "./build";
import { FEE_CODES, feeSchedule } from "./fees";

const NOW = new Date("2026-09-30T09:00:00Z");
const data = buildSeedData(NOW);

const byId = <T extends { id?: string }>(rows: T[], id: string): T => {
  const row = rows.find((r) => r.id === id);
  if (!row) throw new Error(`missing ${id}`);
  return row;
};
const asDate = (v: string | Date | null | undefined): Date => new Date(v as string | Date);

describe("dataset shape", () => {
  it("has 1 bank, 25 customers and all named personas", () => {
    expect(data.bank.name).toBe("Doha Demo Bank");
    expect(data.bank.deepLinkScheme).toBe("ddb://");
    expect(data.customers).toHaveLength(25);
    for (const p of NAMED_PERSONAS)
      expect(data.customers.some((c) => c.personaKey === p)).toBe(true);
  });

  it("is deterministic for the same now", () => {
    expect(JSON.stringify(buildSeedData(NOW))).toBe(JSON.stringify(data));
  });

  it("has unique ids everywhere", () => {
    for (const rows of [
      data.customers,
      data.accounts,
      data.cards,
      data.finances,
      data.deposits,
      data.transactions,
    ]) {
      const ids = rows.map((r) => r.id);
      expect(new Set(ids).size).toBe(ids.length);
    }
  });

  it("mixes conventional and Islamic holdings, en and ar customers", () => {
    expect(new Set(data.cards.map((c) => c.type))).toEqual(new Set(["conventional", "islamic"]));
    expect(new Set(data.finances.map((f) => f.type))).toEqual(
      new Set(["conventional", "murabaha", "ijara"]),
    );
    expect(new Set(data.customers.map((c) => c.preferredLocale))).toEqual(new Set(["en", "ar"]));
    expect(data.customers.every((c) => c.displayName && c.displayNameAr)).toBe(true);
  });

  it("records consent for all but the two no-consent customers", () => {
    const withConsent = new Set(data.consents.map((c) => c.customerId));
    expect(withConsent.size).toBe(23);
    expect(withConsent.has("cus_priya")).toBe(false);
    expect(withConsent.has("cus_ali")).toBe(false);
  });
});

describe("synthetic identifiers cannot collide with real ones", () => {
  it("PANs start with 0000 and fail the Luhn check", () => {
    for (const c of data.cards) {
      expect(c.pan).toMatch(/^0000\d{12}$/);
      expect(isLuhnValid(c.pan)).toBe(false);
      expect(c.pan.endsWith(c.panLast4)).toBe(true);
    }
  });

  it("IBANs carry invalid 00 check digits; phones and emails are non-routable", () => {
    for (const a of data.accounts) expect(a.iban).toMatch(/^QA00DDBX\d{21}$/);
    for (const c of data.customers) {
      expect(c.phone).toMatch(/^\+97400000\d{3}$/);
      expect(c.email).toMatch(/\.example\.test$/);
    }
  });
});

describe("named personas (hand-checked values)", () => {
  it("Khalid: 42,000 points at QAR 0.01, 8,000 expiring in 45 days, one active EPP", () => {
    const card = byId(data.cards, "card_khalid_platinum");
    expect(card.tier).toBe("platinum");
    expect(card.supplementaryCount).toBe(1);
    const ledger = data.rewardsLedgers.find((r) => r.cardId === card.id);
    expect(ledger?.balance).toBe(42000);
    expect(ledger?.pointValueQar).toBe("0.0100");
    // 42,000 x 0.01 = QAR 420.00
    expect(toMoneyString(D(ledger?.balance ?? 0).times(D(ledger?.pointValueQar as string)))).toBe(
      "420.00",
    );
    const buckets = ledger?.expiryBuckets as { points: number; expiresAt: string }[];
    expect(buckets[0]).toEqual({ points: 8000, expiresAt: "2026-11-14" }); // 30 Sep + 45 days
    expect(buckets.reduce((s, b) => s + b.points, 0)).toBe(42000);
    const plans = data.instalmentPlans.filter((p) => p.cardId === card.id);
    expect(plans).toHaveLength(1);
    // 7,200 / 12 = 600 a month; 6 of 12 paid -> 3,600 remaining
    expect(plans[0]).toMatchObject({
      monthlyAmount: "600.00",
      principalRemaining: "3600.00",
      monthsRemaining: 6,
    });
  });

  it("Fatima: murabaha with ibra, 11 of 48 paid, next instalment in 19 days", () => {
    const fin = byId(data.finances, "fin_fatima_murabaha");
    expect(fin.type).toBe("murabaha");
    // Profit = 120,000 x 4.75% x 4y = 22,800; sale price 142,800 / 48 = 2,975.00 a month
    expect(fin.instalment).toBe("2975.00");
    // Principal 2,500/month; 120,000 - 11 x 2,500 = 92,500
    expect(fin.principalOutstanding).toBe("92500.00");
    expect(daysBetween(NOW, asDate(fin.nextInstalmentAt))).toBe(19);
    expect(fin.rebateRule).toMatchObject({ type: "ibra_tiers" });
    expect(fin.insuranceOrTakaful).toMatchObject({ kind: "takaful", premiumPaid: "1800.00" });
    const schedule = fin.schedule as { n: number; paid: boolean; profitOrInterest: string }[];
    expect(schedule.filter((e) => e.paid)).toHaveLength(11);
    expect(schedule[11]?.profitOrInterest).toBe("475.00");
  });

  it("Ravi: pays minimum only at high utilisation", () => {
    const card = byId(data.cards, "card_ravi_gold");
    // 18,420 / 20,000 = 92.1% utilisation
    expect(
      D(card.balance as string)
        .dividedBy(D(card.creditLimit as string))
        .greaterThan(D("0.9")),
    ).toBe(true);
    // min due = max(5% x 18,150 = 907.50, 100) = 907.50
    expect(card.minDue).toBe("907.50");
    const payments = data.transactions.filter((t) => t.cardId === card.id && t.type === "payment");
    expect(payments.length).toBe(6);
    expect(payments.every((p) => p.amount === "907.50")).toBe(true);
  });

  it("Aisha: term deposit 9 days from maturity", () => {
    const dep = byId(data.deposits, "dep_aisha_term12");
    expect(dep.principal).toBe("200000.00");
    expect(daysBetween(NOW, asDate(dep.maturityAt))).toBe(9);
  });

  it("Omar: salary transfer, salary-linked finance and fee waivers", () => {
    expect(byId(data.customers, "cus_omar").salaryTransfer).toBe(true);
    expect(byId(data.finances, "fin_omar_personal").salaryLinked).toBe(true);
    expect(byId(data.cards, "card_omar_gold").annualFeeWaived).toBe(true);
    expect(byId(data.accounts, "acc_omar_current").maintenanceFeeWaived).toBe(true);
  });

  it("dormancy candidates are within 60 days of dormancy", () => {
    for (const id of ["acc_tariq_savings", "acc_grace_current"]) {
      const a = byId(data.accounts, id);
      const daysToDormancy = (a.dormancyDays ?? 365) - daysBetween(asDate(a.lastActivityAt), NOW);
      expect(daysToDormancy).toBeGreaterThan(0);
      expect(daysToDormancy).toBeLessThanOrEqual(60);
      // no customer-initiated transactions after lastActivityAt
      const customerTxns = data.transactions.filter((t) => t.accountId === id && t.type !== "fee");
      expect(customerTxns.every((t) => asDate(t.postedAt) <= asDate(a.lastActivityAt))).toBe(true);
    }
  });
});

describe("transactions", () => {
  it("cover 6 months for every customer and never lie in the future", () => {
    const sixMonthsAgo = new Date("2026-03-30T00:00:00Z");
    const accountOwner = new Map(data.accounts.map((a) => [a.id, a.customerId]));
    const cardOwner = new Map(data.cards.map((c) => [c.id, c.customerId]));
    const perCustomer = new Map<string, Date[]>();
    for (const t of data.transactions) {
      const owner = t.accountId ? accountOwner.get(t.accountId) : cardOwner.get(t.cardId ?? "");
      expect(owner).toBeDefined();
      const d = asDate(t.postedAt);
      expect(d.getTime()).toBeLessThan(NOW.getTime());
      expect(d.getTime()).toBeGreaterThanOrEqual(sixMonthsAgo.getTime());
      perCustomer.set(owner ?? "", [...(perCustomer.get(owner ?? "") ?? []), d]);
    }
    expect(perCustomer.size).toBe(25);
    for (const dates of perCustomer.values()) {
      const months = new Set(dates.map((d) => d.toISOString().slice(0, 7)));
      expect(months.size).toBeGreaterThanOrEqual(6);
    }
  });

  it("uses positive 2-dp decimal strings for every amount", () => {
    for (const t of data.transactions) expect(t.amount).toMatch(/^\d+\.\d{2}$/);
  });

  it("maps every fee line to a FeeSchedule code, and fee lines are type fee or finance charges", () => {
    const codes = new Set(feeSchedule.map((f) => f.code));
    const feeLines = data.transactions.filter((t) => t.feeCode);
    expect(feeLines.length).toBeGreaterThan(50);
    for (const t of feeLines) {
      expect(codes.has(t.feeCode ?? "")).toBe(true);
      expect(["fee", "interest_charge", "profit_charge"]).toContain(t.type);
    }
    for (const t of data.transactions.filter((x) => x.type === "fee"))
      expect(t.feeCode).toBeTruthy();
  });

  it("charges the cash withdrawal fee at 3% with a QAR 60 minimum", () => {
    // Ravi withdrew 1,000: 3% = 30.00 < 60.00 minimum -> 60.00
    const fee = data.transactions.find(
      (t) => t.cardId === "card_ravi_gold" && t.feeCode === FEE_CODES.cardCashAdvance,
    );
    expect(fee?.amount).toBe("60.00");
  });

  it("charges Khalid's EPP processing fee at 1.5% (min 50): 7,200 x 1.5% = 108.00", () => {
    const fee = data.transactions.find(
      (t) => t.cardId === "card_khalid_platinum" && t.feeCode === FEE_CODES.cardEppProcessing,
    );
    expect(fee?.amount).toBe("108.00");
  });

  it("uses the late-payment charity code (not a late fee) on Islamic cards", () => {
    const islamicCards = new Set(data.cards.filter((c) => c.type === "islamic").map((c) => c.id));
    const lateOnIslamic = data.transactions.filter(
      (t) => islamicCards.has(t.cardId ?? "") && t.feeCode === FEE_CODES.cardLate,
    );
    expect(lateOnIslamic).toHaveLength(0);
    expect(
      data.transactions.some(
        (t) => islamicCards.has(t.cardId ?? "") && t.feeCode === FEE_CODES.islamicLateCharity,
      ),
    ).toBe(true);
  });
});

describe("JSON rules never contain float numbers (D-004)", () => {
  it("stores money and rates as strings in every Json column", () => {
    const jsonColumns = [
      ...data.cards.map((c) => c.feeRefundRule),
      ...data.instalmentPlans.map((p) => p.earlyClosureFeeRule),
      ...data.finances.flatMap((f) => [
        f.settlementFeeRule,
        f.rebateRule,
        f.insuranceOrTakaful,
        f.schedule,
      ]),
      ...data.deposits.flatMap((d) => [d.breakPenaltyRule, d.profitOnBreakRule]),
      ...data.feeSchedule.map((f) => f.amountRule),
    ];
    const nonIntegerNumbers: unknown[] = [];
    const walk = (v: unknown): void => {
      if (typeof v === "number" && !Number.isInteger(v)) nonIntegerNumbers.push(v);
      else if (v && typeof v === "object") Object.values(v).forEach(walk);
    };
    jsonColumns.forEach(walk);
    expect(nonIntegerNumbers).toEqual([]);
  });
});

describe("minimumDue (synthetic formula: max(5%, QAR 100), capped at balance)", () => {
  it.each([
    ["18150.00", "907.50"], // 5% = 907.50
    ["1500.00", "100.00"], // 5% = 75.00 -> floor 100
    ["60.00", "60.00"], // below floor -> whole balance
    ["0.00", "0.00"],
    ["2001.10", "100.06"], // 5% = 100.055 -> half-up 100.06
  ])("statement %s -> min due %s", (stmt, expected) => {
    expect(toMoneyString(minimumDue(D(stmt)))).toBe(expected);
  });
});

describe("buildSchedule", () => {
  const first = new Date("2026-01-15T00:00:00Z");

  it("murabaha flat: 12,000 at 5% over 12 months", () => {
    // profit = 12,000 x 5% x 1y = 600; instalment = 12,600 / 12 = 1,050; principal 1,000, profit 50
    const s = buildSchedule(
      {
        type: "murabaha",
        originalPrincipal: "12000.00",
        ratePct: "5.0000",
        tenorMonths: 12,
        monthsElapsed: 3,
      },
      first,
    );
    expect(s).toHaveLength(12);
    expect(s[0]).toMatchObject({
      n: 1,
      dueAt: "2026-01-15",
      principal: "1000.00",
      profitOrInterest: "50.00",
      instalment: "1050.00",
      paid: true,
    });
    expect(s[3]?.paid).toBe(false);
    expect(s[11]).toMatchObject({ dueAt: "2026-12-15", balanceAfter: "0.00" });
  });

  it("conventional annuity: 10,000 at 12% over 12 months", () => {
    // r = 1% a month; instalment = 10,000 x 0.01 / (1 - 1.01^-12) = 888.4878... -> 888.49
    // month 1: interest 100.00, principal 788.49, balance 9,211.51
    const s = buildSchedule(
      {
        type: "conventional",
        originalPrincipal: "10000.00",
        ratePct: "12.0000",
        tenorMonths: 12,
        monthsElapsed: 0,
      },
      first,
    );
    expect(s[0]).toMatchObject({
      instalment: "888.49",
      profitOrInterest: "100.00",
      principal: "788.49",
      balanceAfter: "9211.51",
    });
    expect(s[11]?.balanceAfter).toBe("0.00");
    const principalSum = s.reduce((acc, e) => acc.plus(D(e.principal)), D(0));
    expect(toMoneyString(principalSum)).toBe("10000.00");
    // last instalment absorbs rounding: within a few dirhams of the regular one
    expect(
      D(s[11]?.instalment ?? "0")
        .minus(D("888.49"))
        .abs()
        .lessThan(D("0.10")),
    ).toBe(true);
  });
});
