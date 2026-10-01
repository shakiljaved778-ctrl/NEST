import { describe, expect, it } from "vitest";
import { classify } from "./classify";

describe("classify (local, deterministic)", () => {
  it.each([
    ["What happens if I close my card?", "en", "card.close"],
    ["what happens if i close my gold card", "en", "card.close"],
    ["ماذا يحدث إذا أغلقت بطاقتي؟", "ar", "card.close"],
    ["I want to cancel my platinum card", "en", "card.close"],
    ["When is the cheapest day to settle my finance?", "en", "compare.settlement_timing"],
    ["ما أقل الأيام تكلفة لسداد تمويلي؟", "ar", "compare.settlement_timing"],
    ["Can I settle my murabaha early?", "en", "finance.early_settlement"],
    ["Should I wait or break my deposit now?", "en", "compare.deposit_break_vs_wait"],
    ["هل أنتظر أم أكسر وديعتي الآن؟", "ar", "compare.deposit_break_vs_wait"],
    ["I want to break my deposit", "en", "deposit.break"],
    ["What if I only pay the minimum?", "en", "card.minimum_payment"],
    ["compare minimum payment with paying more", "en", "compare.min_vs_custom_payment"],
    ["What does a cash withdrawal on my card cost?", "en", "card.cash_withdrawal"],
    ["withdraw cash 2,000", "en", "card.cash_withdrawal"],
    ["What changes if I move my salary?", "en", "salary.transfer_change"],
    ["ما الذي يتغيّر إذا نقلت راتبي؟", "ar", "salary.transfer_change"],
    ["Why was I charged a fee?", "en", "explain.charge"],
    ["لماذا احتُسبت عليّ رسوم؟", "ar", "explain.charge"],
    ["When do my points expire?", "en", "rewards.expiry"],
    ["Is any account about to become dormant?", "en", "account.dormancy"],
    ["close my savings account", "en", "account.close"],
    ["balance transfer of 5000", "en", "card.balance_transfer"],
    ["top up my loan by 20000 over 60 months", "en", "finance.top_up"],
    ["convert my purchase to an instalment plan", "en", "card.epp_conversion"],
    ["What products do I have?", "en", "products"],
    ["hello", "en", "help"],
    ["What is ibra?", "en", "faq"],
    ["ما هو الإبراء؟", "ar", "faq"],
    ["what makes an account dormant", "en", "faq"],
  ] as const)("%j -> %s", (message, locale, intent) => {
    expect(classify(message, locale).intent).toBe(intent);
  });

  it.each([
    ["Should I invest in stocks?", "en"],
    ["Which card should I get?", "en"],
    ["Is it a good time to buy gold?", "en"],
    ["Can you recommend a fund?", "en"],
    ["هل تنصحني بالاستثمار في الأسهم؟", "ar"],
    ["ما هو سعر الذهب اليوم", "ar"],
  ] as const)("refuses investment advice: %j", (message, locale) => {
    expect(classify(message, locale).intent).toBe("refuse_advice");
  });

  it.each([
    ["What's the weather in Doha?", "en"],
    ["Tell me a joke", "en"],
    ["Is QNB better?", "en"],
    ["كيف الطقس اليوم", "ar"],
  ] as const)("refuses out-of-scope questions: %j", (message, locale) => {
    expect(classify(message, locale).intent).toBe("refuse_scope");
  });

  it("falls back to unknown", () => {
    expect(classify("blue elephants dancing", "en").intent).toBe("unknown");
  });

  it("extracts amounts (Latin and Arabic-Indic digits), months and product hints", () => {
    expect(classify("withdraw QAR 1,500 cash from my platinum card", "en")).toMatchObject({
      amount: "1500",
      hints: ["platinum"],
    });
    expect(classify("سحب نقدي ٢٠٠٠ ر.ق", "ar").amount).toBe("2000");
    expect(classify("top up 20000 over 48 months", "en")).toMatchObject({
      amount: "20000",
      months: 48,
    });
    expect(classify("settle my murabaha", "en").hints).toEqual(["murabaha"]);
    expect(classify("close my card", "en").amount).toBeUndefined();
  });
});
