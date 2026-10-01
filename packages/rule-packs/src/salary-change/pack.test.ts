import { describe, expect, it } from "vitest";
import { levelSchedule, salaryChange, thresholds } from "../fixtures";
import { PACKS } from "../registry";
import { evaluateSalaryChange } from "./pack";

const params = PACKS["salary.transfer_change"].conventional.defaultParameters;

describe("salary.transfer_change", () => {
  it("worked example: a 6% salary-linked loan, a murabaha and two waivers", () => {
    // Loan: 12,000 over 12 months at 6% + 1.50 = 7.50%: 1,041.09 vs 1,032.80 -> +8.29 × 12 = 99.48
    // Murabaha 520.00 unchanged (sale price fixed). Unlinked finance ignored.
    // Waivers: 25.00 × 12 + 500.00 = 800.00. Basis 899.48 -> critical.
    const ev = evaluateSalaryChange(salaryChange(), params, thresholds);
    const v = Object.fromEntries(
      Object.entries(ev.facts)
        .filter(([k]) => k !== "_sources")
        .map(([k, f]) => [k, (f as { value: string }).value]),
    );
    expect(v).toEqual({
      salaryLinkedFinances: "2",
      currentRatePct: "6.00",
      newRatePct: "7.50",
      currentInstalmentTotal: "1552.80",
      newInstalmentTotal: "1561.09",
      instalmentIncrease: "8.29",
      extraCostRemainingTerm: "99.48",
      outstandingSalaryLinked: "18000.00",
      clearanceRequired: "false",
      maintenanceFeeWaivedMonthly: "25.00",
      annualFeesWaived: "500.00",
      waiversLostAnnual: "800.00",
    });
    expect([ev.applicable, ev.severity]).toEqual([true, "critical"]);
    expect(ev.explanation.slice(0, 2)).toEqual([
      "salary_linked_pricing_changes",
      "salary_linked_waivers_end",
    ]);
    expect(ev.options).toEqual([
      "view_linked_benefits",
      "continue_salary_change",
      "talk_to_someone",
    ]);
  });

  it("only waivers: no rate shown, clearance only when something is linked", () => {
    const ev = evaluateSalaryChange(
      salaryChange({ finances: [] }),
      { ...params, clearanceRequired: true },
      thresholds,
    );
    expect([
      ev.facts.currentRatePct.value,
      ev.facts.newRatePct.value,
      ev.facts.clearanceRequired.value,
    ]).toEqual(["0.00", "0.00", "false"]);
    expect(ev.explanation[0]).toBe("salary_linked_waivers_end");
    expect(ev.applicable).toBe(true);
  });

  it("skips fully paid finance and requires clearance when configured", () => {
    const paid = levelSchedule("1000.00", "100.00", 2).map((e) => ({ ...e, paid: true }));
    const ev = evaluateSalaryChange(
      salaryChange({
        finances: [
          { id: "f", type: "ijara", ratePct: "5.0000", salaryLinked: true, schedule: paid },
        ],
        accounts: [],
        cards: [],
      }),
      { ...params, clearanceRequired: true },
      thresholds,
    );
    expect([
      ev.facts.instalmentIncrease.value,
      ev.facts.clearanceRequired.value,
      ev.facts.newRatePct.value,
    ]).toEqual(["0.00", "true", "0.00"]);
  });

  it.each([
    ["the salary is not paid here", { salaryTransfer: false }],
    ["nothing is linked", { finances: [], accounts: [], cards: [] }],
  ])("is not applicable when %s", (_name, overrides) => {
    expect(evaluateSalaryChange(salaryChange(overrides), params, thresholds).applicable).toBe(
      false,
    );
  });
});
