import { normaliseDigits } from "@amil/i18n";
import { normaliseQuery, searchKnowledge } from "@amil/rule-packs";

/**
 * Ask AMIL intent classification. Deterministic and local: the customer's free text never leaves
 * the bank's perimeter (non-negotiable 6: in redacted mode the model sees fact sets only, never
 * free text). English and Arabic patterns; the bank's FAQ is the fallback.
 */
export const ACTION_INTENTS = [
  "card.close",
  "finance.early_settlement",
  "finance.top_up",
  "card.cash_withdrawal",
  "card.minimum_payment",
  "card.epp_conversion",
  "card.balance_transfer",
  "deposit.break",
  "salary.transfer_change",
  "account.close",
  "account.dormancy",
  "rewards.expiry",
] as const;
export type PackIntent = (typeof ACTION_INTENTS)[number];

export type Intent =
  | PackIntent
  | "compare.settlement_timing"
  | "compare.min_vs_custom_payment"
  | "compare.deposit_break_vs_wait"
  | "explain.charge"
  | "products"
  | "faq"
  | "help"
  | "refuse_advice"
  | "refuse_scope"
  | "unknown";

export interface Classified {
  intent: Intent;
  /** QAR amount mentioned ("1,000", "QAR 500", "٥٠٠ ر.ق"), as a decimal string. */
  amount?: string;
  /** Months mentioned ("12 months", "١٢ شهراً"). */
  months?: number;
  /** Product words that narrow which product is meant (tier, finance type, account kind). */
  hints: string[];
  /** FAQ entry id when intent is "faq". */
  faqId?: string;
}

type Rule = [Intent, RegExp];

// Order matters: refusals first, then comparisons, then specific actions.
const RULES: Rule[] = [
  [
    "refuse_advice",
    /\b(invest(ment|ing)?s?|stocks?|shares|crypto|bitcoin|mutual funds?|portfolio|which (card|product|bank|account|deposit) should i|should i (buy|invest|apply|open|get a|take a)|recommend|best (card|bank|loan|deposit|product|offer))\b|\b(buy|invest in|price of) gold\b|\bgold (price|bars?|coins?)\b|استثمار|أسهم|اسهم|عملات رقمية|بيتكوين|سعر الذهب|شراء الذهب|أشتري ذهب|صناديق|تنصحني|أنصح|انصح|افضل بطاقة|أفضل بطاقة|افضل بنك|أفضل بنك|هل اشتري|هل أشتري/u,
  ],
  [
    "refuse_scope",
    /\b(weather|joke|football|recipe|politics|news|another bank|other banks?|qnb|cbq|movie|song)\b|الطقس|نكتة|كرة القدم|وصفة|سياسة|الأخبار|بنك آخر|بنوك أخرى/u,
  ],
  [
    "compare.settlement_timing",
    /\b(cheapest|cheaper|best|least expensive) (day|date|time)\b.*\b(settle|pay off|payoff)|\bwhen (should|can) i (settle|pay off)|\bcompare\b.*\bsettl/u,
  ],
  [
    "compare.settlement_timing",
    /أقل.*تكلفة.*سداد|أقل الأيام تكلفة|متى.*أسدد|متى اسدد|مقارنة.*السداد/u,
  ],
  [
    "compare.deposit_break_vs_wait",
    /\b(wait|keep)\b.*\b(break|deposit)|\bbreak\b.*\bor\b.*\b(wait|keep)|أنتظر.*أكسر|انتظر.*اكسر|أكسر.*أنتظر/u,
  ],
  [
    "compare.min_vs_custom_payment",
    /\bcompare\b.*\b(payment|minimum)|\bminimum\b.*\b(vs|versus|or pay more|compared)\b|مقارنة.*الحد الأدنى/u,
  ],
  [
    "explain.charge",
    /\b(why|what)\b.*\b(charged?|fees?|charges)\b|\bexplain\b.*\b(charge|fee)|لماذا.*رسوم|ما هذه الرسوم|احتسبت|احتُسبت|اشرح.*رسوم/u,
  ],
  [
    "rewards.expiry",
    /\bpoints?\b.*\bexpir|\bexpir\w*\b.*\bpoints?\b|صلاحية.*نقاط|نقاط.*صلاحية|تنتهي.*نقاط/u,
  ],
  ["account.dormancy", /\b(dormant|dormancy|inactive)\b|خامل|الخمول/u],
  [
    "salary.transfer_change",
    /\b(move|change|transfer|switch)\b.*\bsalary\b|نقل.*راتب|تحويل.*الراتب|اغير.*راتب|أغير.*راتب/u,
  ],
  [
    "card.close",
    /\b(close|cancel|terminate|stop)\b.*\bcard\b|(إغلاق|اغلاق|أغلق|اغلق|إلغاء|الغاء|ألغي|الغي).*بطاق/u,
  ],
  ["account.close", /\b(close|cancel)\b.*\baccount\b|(إغلاق|اغلاق|أغلق|اغلق).*حساب/u],
  [
    "card.balance_transfer",
    /\bbalance transfer\b|\btransfer\b.*\bbalance\b|تحويل الرصيد|تحويل رصيد/u,
  ],
  [
    "card.cash_withdrawal",
    /\bcash (withdrawal|advance)\b|\bwithdraw\b.*\bcash\b|\batm\b|سحب نقد|السحب النقدي|سحب.*نقدا/u,
  ],
  ["card.minimum_payment", /\bminimum\b|الحد الأدنى|الحد الادنى/u],
  [
    "card.epp_conversion",
    /\b(instal+ments?|epp|split)\b.*\b(plan|purchase)|\bconvert\b.*\bpurchase|تقسيط|أقساط.*مشتريات|حول.*مشتريات/u,
  ],
  [
    "finance.top_up",
    /\btop[- ]?up\b|\bborrow more\b|\bincrease\b.*\b(loan|finance)\b|زيادة التمويل|تمويل إضافي/u,
  ],
  [
    "finance.early_settlement",
    /\b(settle|settlement|pay off|payoff|repay early)\b|\bclose\b.*\b(loan|finance)\b|سداد مبكر|السداد المبكر|أسدد.*تمويل|اسدد.*تمويل|تسوية/u,
  ],
  [
    "deposit.break",
    /\bbreak\b.*\b(deposit|investment)|\bdeposit\b.*\bearly\b|كسر.*وديع|كسر.*استثمار/u,
  ],
  [
    "products",
    /\b(what|which|list|show)\b.*\b(products|cards|accounts|finances?|deposits) (do i have|i have|i hold)|\bmy products\b|منتجاتي|ما المنتجات|ماذا أملك/u,
  ],
  ["help", /^(hi|hello|hey|help|salam|what can you do)\b|ماذا تستطيع|مساعدة|^مرحبا|^السلام عليكم/u],
];

const DEFINITIONAL =
  /^(what is|what's|what are|what does|what do|what makes|explain what|ما هو|ما هي|ماذا يعني|ما معنى|متى يصبح)/u;

const PERSONAL = /\b(my|mine|i|me)\b|بطاقتي|حسابي|تمويلي|قرضي|وديعتي|راتبي|نقاطي|استثماري/u;

const HINTS: [string, RegExp][] = [
  ["platinum", /\bplatinum\b|بلاتيني/u],
  ["gold", /\bgold\b|ذهبية/u],
  ["classic", /\bclassic\b|كلاسيك/u],
  ["signature", /\bsignature\b|سيجنتشر/u],
  ["murabaha", /\bmurabaha\b|مرابحة/u],
  ["ijara", /\bijara\b|إجارة|اجارة/u],
  ["loan", /\bloan\b|قرض/u],
  ["savings", /\bsavings?\b|توفير|ادخار/u],
  ["current", /\bcurrent\b|جاري/u],
  ["islamic", /\bislamic\b|إسلامي|اسلامي/u],
];

/** The FAQ entry a question matches, in either language (the answer is given in the customer's). */
function faqFor(message: string, locale: "en" | "ar") {
  return (
    searchKnowledge(message, locale) ?? searchKnowledge(message, locale === "en" ? "ar" : "en")
  );
}

/** Classify a customer's message. */
export function classify(message: string, locale: "en" | "ar"): Classified {
  const text = normaliseDigits(message).toLowerCase();
  const hints = HINTS.filter(([, re]) => re.test(text)).map(([h]) => h);
  const base = { hints, ...amountOf(text), ...monthsOf(text) };

  // "What is ibra?" is a rules question even if it names a product: answer from the FAQ.
  // Questions about the customer's own products ("my card", "بطاقتي") are answered from them.
  if (DEFINITIONAL.test(normaliseQuery(message)) && !PERSONAL.test(text)) {
    const faq = faqFor(message, locale);
    if (faq && !RULES.slice(0, 2).some(([, re]) => re.test(text)))
      return { ...base, intent: "faq", faqId: faq.id };
  }
  for (const [intent, re] of RULES) if (re.test(text)) return { ...base, intent };
  const faq = faqFor(message, locale);
  return faq ? { ...base, intent: "faq", faqId: faq.id } : { ...base, intent: "unknown" };
}

function amountOf(text: string): { amount?: string } {
  const m =
    /(?:qar|ر\.?ق|ريال)\s*([\d,]+(?:\.\d{1,2})?)|([\d,]+(?:\.\d{1,2})?)\s*(?:qar|ر\.?ق|ريال|riyals?)|\b(\d{1,3}(?:,\d{3})+|\d{3,9})(?:\.\d{1,2})?\b/u.exec(
      text,
    );
  const raw = m?.[1] ?? m?.[2] ?? m?.[3];
  if (!raw) return {};
  const amount = raw.replace(/,/g, "");
  return /^\d{1,9}(\.\d{1,2})?$/.test(amount) && Number(amount) > 0 ? { amount } : {};
}

function monthsOf(text: string): { months?: number } {
  const m = /(\d{1,3})\s*(?:months?|شهر|شهراً|شهرا|أشهر|اشهر)/u.exec(text);
  const n = m ? Number(m[1]) : NaN;
  return Number.isInteger(n) && n > 0 && n <= 360 ? { months: n } : {};
}
