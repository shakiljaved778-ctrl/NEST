import { describe, expect, it } from "vitest";
import { accountClose, NOW, thresholds } from "../fixtures";
import { PACKS } from "../registry";
import { evaluateAccountClose } from "./pack";

const params = PACKS["account.close"].conventional.defaultParameters;

describe("account.close", () => {
  it("worked example: Hessa, cheques outstanding and two active standing orders", () => {
    // payout 14,250.00 − 25.00 = 14,225.00; orders 3,500.00 (5 Oct) + 450.00 (20 Oct) = 3,950.00
    const ev = evaluateAccountClose(accountClose(), params, thresholds, NOW);
    const v = Object.fromEntries(
      Object.entries(ev.facts)
        .filter(([k]) => k !== "_sources")
        .map(([k, f]) => [k, (f as { value: string }).value]),
    );
    expect(v).toEqual({
      currentBalance: "14250.00",
      closureFee: "25.00",
      netPayout: "14225.00",
      chequesOutstanding: "3",
      activeStandingOrders: "2",
      standingOrdersTotal: "3950.00",
      nextStandingOrderDate: "2026-10-05",
      nextStandingOrderAmount: "3500.00",
      standingOrdersDueSoon: "2",
      linkedCards: "1",
      receivesSalary: "true",
      salaryLinkedFinances: "0",
    });
    expect([ev.applicable, ev.severity]).toEqual([true, "critical"]);
    expect(ev.options).toEqual([
      "review_standing_orders",
      "continue_account_close",
      "talk_to_someone",
    ]);
    expect(ev.explanation).toContain("cheques_outstanding_may_bounce");
  });

  it("salary-linked finance on the salary account is critical", () => {
    const ev = evaluateAccountClose(
      accountClose({ chequesOutstanding: 0, standingOrders: [] }, { salaryLinkedFinances: 1 }),
      params,
      thresholds,
      NOW,
    );
    expect(ev.severity).toBe("critical");
    expect(ev.explanation[0]).toBe("salary_linked_finance_depends_on_account");
    expect(ev.options).toEqual(["continue_account_close", "talk_to_someone"]);
    expect(ev.facts.nextStandingOrderDate.value).toBe("");
  });

  it("standing orders alone are a caution; only those within the horizon count as due soon", () => {
    const ev = evaluateAccountClose(
      accountClose(
        {
          chequesOutstanding: 0,
          isSalaryAccount: false,
          standingOrders: [
            { amount: "100.00", nextRunAt: new Date("2026-12-01T00:00:00Z"), active: true },
          ],
        },
        { linkedCards: 0 },
      ),
      params,
      thresholds,
      NOW,
    );
    expect([ev.severity, ev.facts.standingOrdersDueSoon.value]).toEqual(["caution", "0"]);
  });

  it("a plain account with only the closure fee is info and still shown", () => {
    const ev = evaluateAccountClose(
      accountClose(
        { chequesOutstanding: 0, isSalaryAccount: false, standingOrders: [] },
        { linkedCards: 0 },
      ),
      params,
      thresholds,
      NOW,
    );
    expect([ev.applicable, ev.severity, ev.explanation[0]]).toEqual([
      true,
      "info",
      "closure_fee_applies",
    ]);
  });

  it("is not applicable when nothing is linked and there is no fee; payout is never negative", () => {
    const ev = evaluateAccountClose(
      accountClose(
        {
          chequesOutstanding: 0,
          isSalaryAccount: false,
          standingOrders: [],
          closureFee: "0.00",
          balance: "0.00",
        },
        { linkedCards: 0 },
      ),
      params,
      thresholds,
      NOW,
    );
    expect(ev.applicable).toBe(false);
    expect(ev.facts.netPayout.value).toBe("0.00");
  });
});
