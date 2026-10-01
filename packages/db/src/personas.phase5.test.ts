/**
 * Phase 5 acceptance: every rule pack fires for at least two seeded personas, evaluated from the
 * actual seed rows through the shared input resolver and the registered packs, and the approved
 * copy renders for each of them.
 */
import { formatFact } from "@amil/gateway";
import { getPack, type PackKey, RULE_PACK_KEYS, renderTemplate, TEMPLATES } from "@amil/rule-packs";
import type { AnyEvaluation, Fact } from "@amil/rules-engine";
import { describe, expect, it } from "vitest";
import { thresholdsFor } from "./adapters";
import { bundleFromSeed } from "./bundle";
import { demoContexts, resolvePackInput } from "./pack-inputs";
import { buildSeedData } from "./seed/build";

const NOW = new Date("2026-09-30T09:00:00Z");
const data = buildSeedData(NOW);
const consenting = new Set(
  data.consents.filter((c) => c.purpose === "pre_decision_insights").map((c) => c.customerId),
);

interface Fired {
  persona: string;
  variant: string;
  evaluation: AnyEvaluation;
}

function fired(key: PackKey): Fired[] {
  const out: Fired[] = [];
  for (const customer of data.customers) {
    if (!consenting.has(customer.id)) continue;
    const bundle = bundleFromSeed(data, customer.id);
    for (const ctx of demoContexts(key, bundle)) {
      const resolved = resolvePackInput(key, bundle, ctx, NOW);
      if (!resolved) continue;
      const pack = getPack(key, resolved.variant);
      const evaluation = pack.evaluate(
        resolved.input as never,
        pack.defaultParameters,
        thresholdsFor(data.bank.severityThresholds, key),
        NOW,
      );
      if (evaluation.applicable)
        out.push({
          persona: customer.personaKey ?? customer.id,
          variant: resolved.variant,
          evaluation,
        });
    }
  }
  return out;
}

const RESULTS = Object.fromEntries(RULE_PACK_KEYS.map((k) => [k, fired(k)])) as Record<
  PackKey,
  Fired[]
>;

describe("every pack fires for at least two personas", () => {
  it.each(RULE_PACK_KEYS.map((k) => [k]))("%s", (key) => {
    const personas = new Set(RESULTS[key].map((r) => r.persona));
    expect(personas.size, [...personas].join(", ")).toBeGreaterThanOrEqual(2);
  });

  it("matches the coverage map in seed/customers.ts for the Phase 5 packs", () => {
    const personasOf = (k: PackKey) => new Set(RESULTS[k].map((r) => r.persona));
    for (const [key, expected] of [
      ["deposit.break", ["aisha", "mariam", "abdullah"]],
      ["account.dormancy", ["tariq", "grace"]],
      ["rewards.expiry", ["khalid", "noura"]],
      ["salary.transfer_change", ["omar"]],
      ["card.minimum_payment", ["ravi"]],
      ["account.close", ["hessa", "ahmed"]],
    ] as const)
      for (const p of expected) expect(personasOf(key).has(p), `${key}: ${p}`).toBe(true);
  });

  it("never fires for a customer without consent", () => {
    for (const results of Object.values(RESULTS))
      for (const r of results) expect(["priya", "ali"]).not.toContain(r.persona);
  });
});

describe("approved copy renders for every persona that fires", () => {
  it.each(RULE_PACK_KEYS.map((k) => [k]))("%s", (key) => {
    for (const r of RESULTS[key]) {
      for (const locale of ["en", "ar"] as const) {
        const t = TEMPLATES.find(
          (x) =>
            x.rulePackKey === key &&
            x.variant === r.variant &&
            x.locale === locale &&
            x.severity === r.evaluation.severity,
        );
        expect(t, `${key}/${r.persona}`).toBeDefined();
        if (!t) continue;
        const format = (f: Fact) => formatFact(f, { locale, digitStyle: "latn" });
        const headline = renderTemplate(t.headline, r.evaluation.facts, format);
        const body = renderTemplate(t.body, r.evaluation.facts, format);
        expect([...headline.missing, ...body.missing], `${key}/${r.persona}`).toEqual([]);
        expect(headline.text.length, `${r.persona}: ${headline.text}`).toBeLessThanOrEqual(90);
      }
    }
  });
});

describe("Aisha breaks her term deposit", () => {
  it("matches the worked example", () => {
    const aisha = RESULTS["deposit.break"].find((r) => r.persona === "aisha");
    const f = aisha?.evaluation.facts as Record<string, Fact> | undefined;
    expect(
      f && [f.daysToMaturity?.value, f.netReceivedNow?.value, f.differenceIfKeptToMaturity?.value],
    ).toEqual(["9", "199487.67", "9012.33"]);
    expect(aisha?.evaluation.severity).toBe("critical");
  });
});
