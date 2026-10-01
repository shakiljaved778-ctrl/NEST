import { ALL_PACK_DEFINITIONS, cardClosePacks, type CardCloseInput } from "@amil/rule-packs";
import { khalidCard, NOW, thresholds } from "@amil/rule-packs/fixtures";
import type { AnyEvaluation, Fact } from "@amil/rules-engine";
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { buildFactTemplate, isSafeFactKey, REDACTED, RedactionError, scanForPii } from "./redactor";

const display = { locale: "en", digitStyle: "latn" } as const;
const reference = { headline: "Closing this card forfeits value", body: "Approved body." };

type PiiField =
  | "displayName"
  | "displayNameAr"
  | "email"
  | "phone"
  | "iban"
  | "pan"
  | "accountNumber"
  | "externalRef"
  | "customerId";
type Pii = Record<PiiField, string>;

/** Arbitrary synthetic customer PII of the kinds the schema stores (non-negotiable 6). */
const piiArb: fc.Arbitrary<Pii> = fc.record({
  displayName: fc.stringMatching(/^[A-Z][a-z]{2,10} [A-Z][a-z]{2,12}$/),
  displayNameAr: fc.constantFrom("خالد المنصوري", "فاطمة الكواري", "رافي مينون", "عائشة آل ثاني"),
  email: fc.emailAddress(),
  phone: fc.stringMatching(/^\+974[0-9]{8}$/),
  iban: fc.stringMatching(/^QA[0-9]{2}[A-Z]{4}[0-9]{21}$/),
  pan: fc.stringMatching(/^[0-9]{16}$/),
  accountNumber: fc.stringMatching(/^[0-9]{12}$/),
  externalRef: fc.stringMatching(/^DDB-C-[0-9]{4}$/),
  customerId: fc.stringMatching(/^cus_[a-z]{3,10}$/),
});

function evaluateWithCarelessCaller(pii: Record<string, string>): AnyEvaluation {
  // A careless caller spreads whole DB rows into the input: the extra fields must not leak.
  const base = khalidCard();
  const input = {
    ...base,
    customer: { ...pii },
    card: { ...base.card, pan: pii.pan, holderName: pii.displayName, iban: pii.iban },
  } as unknown as CardCloseInput;
  return cardClosePacks.conventional.evaluate(
    input,
    cardClosePacks.conventional.defaultParameters,
    thresholds,
    NOW,
  );
}

const containsAny = (payload: string, pii: Record<string, string>) =>
  Object.values(pii).filter((v) => payload.toLowerCase().includes(v.toLowerCase()));

describe("redactor: property tests (fast-check)", () => {
  it("no customer, account or card identifier ever appears in the outbound payload", () => {
    fc.assert(
      fc.property(piiArb, (pii) => {
        const evaluation = evaluateWithCarelessCaller(pii);
        const payload = JSON.stringify(
          buildFactTemplate({
            action: "card.close",
            variant: "conventional",
            locale: "en",
            evaluation,
            referenceWording: reference,
            display,
          }),
        );
        expect(containsAny(payload, pii)).toEqual([]);
      }),
      { numRuns: 300 },
    );
  });

  it("PII injected into fact values is replaced, or redaction fails closed", () => {
    fc.assert(
      fc.property(
        piiArb,
        fc.constantFrom(
          "pointsBalance",
          "outstandingBalance",
          "nextPointsExpiryDate",
          "pointValueQar",
        ),
        fc.constantFrom<PiiField>(
          "email",
          "phone",
          "iban",
          "pan",
          "accountNumber",
          "displayName",
          "externalRef",
        ),
        (pii, factKey, field) => {
          const evaluation = evaluateWithCarelessCaller(pii);
          const facts = evaluation.facts as unknown as Record<string, Fact>;
          const original = facts[factKey];
          if (!original) throw new Error(factKey);
          facts[factKey] = { ...original, value: pii[field] };
          try {
            const payload = JSON.stringify(
              buildFactTemplate({
                action: "card.close",
                variant: "conventional",
                locale: "en",
                evaluation,
                referenceWording: reference,
                display,
              }),
            );
            // Also with display grouping removed: "123,456,789,012" must not smuggle a 12-digit number.
            expect(payload.replace(/[,\s]/g, "")).not.toContain(pii[field].replace(/\s/g, ""));
            expect(payload).toContain(REDACTED);
          } catch (error) {
            expect(error).toBeInstanceOf(RedactionError);
          }
        },
      ),
      { numRuns: 300 },
    );
  });

  it("PII smuggled in under extra fact keys is dropped", () => {
    fc.assert(
      fc.property(piiArb, (pii) => {
        const evaluation = evaluateWithCarelessCaller(pii);
        const facts = evaluation.facts as unknown as Record<string, Fact>;
        for (const key of [
          "customerName",
          "customerId",
          "iban",
          "cardPan",
          "accountNumber",
          "email",
          "phoneNumber",
          "externalRef",
        ]) {
          facts[key] = {
            key,
            value: pii.displayName,
            unit: "code",
            source: "customer",
            asOf: "2026-09-30",
          };
        }
        const payload = JSON.stringify(
          buildFactTemplate({
            action: "card.close",
            variant: "conventional",
            locale: "en",
            evaluation,
            referenceWording: reference,
            display,
          }),
        );
        expect(containsAny(payload, pii)).toEqual([]);
      }),
      { numRuns: 200 },
    );
  });

  it("PII in the reference wording makes redaction fail closed", () => {
    fc.assert(
      fc.property(
        piiArb,
        fc.constantFrom<PiiField>("email", "phone", "iban", "pan", "accountNumber"),
        (pii, field) => {
          const evaluation = evaluateWithCarelessCaller(pii);
          expect(() =>
            buildFactTemplate({
              action: "card.close",
              variant: "conventional",
              locale: "en",
              evaluation,
              referenceWording: { headline: "Hi", body: `Ref ${pii[field]}` },
              display,
            }),
          ).toThrow(RedactionError);
        },
      ),
      { numRuns: 200 },
    );
  });
});

describe("redactor: payload content", () => {
  it("contains only facts, metadata and reference wording; never _sources or explanations", () => {
    const evaluation = cardClosePacks.conventional.evaluate(
      khalidCard(),
      cardClosePacks.conventional.defaultParameters,
      thresholds,
      NOW,
    );
    const t = buildFactTemplate({
      action: "card.close",
      variant: "conventional",
      locale: "en",
      evaluation,
      referenceWording: reference,
      display,
    });
    expect(Object.keys(t).sort()).toEqual([
      "action",
      "facts",
      "locale",
      "promptVersion",
      "referenceWording",
      "severity",
      "variant",
    ]);
    expect(t.facts.find((f) => f.key === "pointsValue")).toEqual({
      key: "pointsValue",
      unit: "QAR",
      display: "QAR 420.00",
    });
    expect(JSON.stringify(t)).not.toContain("_sources");
  });

  it("adds the Arabic glossary for Arabic wording", () => {
    const evaluation = cardClosePacks.conventional.evaluate(
      khalidCard(),
      cardClosePacks.conventional.defaultParameters,
      thresholds,
      NOW,
    );
    const t = buildFactTemplate({
      action: "card.close",
      variant: "conventional",
      locale: "ar",
      evaluation,
      referenceWording: reference,
      display: { locale: "ar", digitStyle: "latn" },
    });
    expect(t.glossary?.points).toBe("نقاط");
    expect(t.glossary?.["early settlement"]).toBe("السداد المبكر");
    expect(t.glossary?.["profit rate"]).toBe("معدل الربح");
  });

  it("every declared pack fact key passes the identity-key filter", () => {
    for (const def of ALL_PACK_DEFINITIONS)
      for (const f of def.facts) expect(isSafeFactKey(f.key), f.key).toBe(true);
  });

  it.each([
    "customerId",
    "customerRef",
    "displayName",
    "iban",
    "cardPan",
    "pan",
    "accountNumber",
    "email",
    "phoneNumber",
    "mobile",
    "nationalId",
    "passportNo",
    "address",
    "cardNumber",
  ])("rejects identity key %s", (key) => expect(isSafeFactKey(key)).toBe(false));

  it.each([
    ["khalid@customers.ddb.example.test", ["email"]],
    ["QA00DDBX000000000000000000001", ["iban", "long_digit_run"]],
    ["0000 0001 0001 0007", ["long_digit_run"]],
    ["+97400000001", ["phone"]],
    ["Closing this card forfeits 42,000 points (about QAR 420.00) on 14 Nov 2026", []],
  ] as const)("scanForPii(%j)", (text, findings) => {
    expect(scanForPii(text)).toEqual(findings);
  });
});
