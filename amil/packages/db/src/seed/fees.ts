/**
 * Fee schedule for the fictional Doha Demo Bank. SYNTHETIC demo values; not real tariffs.
 * Money and percentages are decimal strings.
 */

export interface FeeDef {
  code: string;
  nameEn: string;
  nameAr: string;
  descriptionEn: string;
  descriptionAr: string;
  avoidTipEn: string;
  avoidTipAr: string;
  amountRule:
    | { type: "fixed"; amount: string }
    | { type: "pct"; pct: string; min?: string }
    | { type: "per_product" }
    | { type: "rate_on_balance" };
}

export const FEE_CODES = {
  cardAnnual: "CARD_ANNUAL_FEE",
  cardLate: "CARD_LATE_PAYMENT",
  islamicLateCharity: "ISL_LATE_CHARITY",
  cardCashAdvance: "CARD_CASH_ADVANCE",
  cardFx: "CARD_FX",
  cardOverlimit: "CARD_OVERLIMIT",
  cardInterest: "CARD_INTEREST",
  cardProfit: "CARD_PROFIT",
  cardEppProcessing: "CARD_EPP_PROCESSING",
  cardBalanceTransfer: "CARD_BALANCE_TRANSFER",
  cardStatementCopy: "CARD_STATEMENT_COPY",
  accMaintenance: "ACC_MAINTENANCE",
  accChequeBook: "ACC_CHEQUE_BOOK",
  accSmsAlerts: "ACC_SMS_ALERTS",
  atmOtherBank: "ATM_OTHER_BANK",
  accClosure: "ACC_CLOSURE",
} as const;

export type FeeCode = (typeof FEE_CODES)[keyof typeof FEE_CODES];

export const FEE_AMOUNTS = {
  cardLate: "150.00",
  cardOverlimit: "100.00",
  cardStatementCopy: "25.00",
  accMaintenance: "25.00",
  accChequeBook: "30.00",
  accSmsAlerts: "10.00",
  atmOtherBank: "5.00",
  accClosure: "25.00",
  cashAdvancePct: "3.00",
  cashAdvanceMin: "60.00",
  fxPct: "2.50",
  eppPct: "1.50",
  eppMin: "50.00",
  balanceTransferPct: "2.00",
} as const;

export const feeSchedule: FeeDef[] = [
  {
    code: FEE_CODES.cardAnnual,
    nameEn: "Card annual fee",
    nameAr: "الرسوم السنوية للبطاقة",
    descriptionEn: "A yearly fee for your credit card, charged on the card's anniversary.",
    descriptionAr: "رسوم سنوية لبطاقة الائتمان تُحتسب في تاريخ الذكرى السنوية لإصدار البطاقة.",
    avoidTipEn:
      "Some cards waive this fee when your salary is transferred to the bank. Check your card's terms.",
    avoidTipAr: "تُعفى بعض البطاقات من هذه الرسوم عند تحويل الراتب إلى البنك. راجع شروط بطاقتك.",
    amountRule: { type: "per_product" },
  },
  {
    code: FEE_CODES.cardLate,
    nameEn: "Late payment fee",
    nameAr: "رسوم التأخر في السداد",
    descriptionEn: "Charged when the minimum payment is not received by the payment due date.",
    descriptionAr: "تُحتسب عند عدم استلام الحد الأدنى للسداد بحلول تاريخ الاستحقاق.",
    avoidTipEn:
      "Pay at least the minimum due before the due date, for example with an automatic payment.",
    avoidTipAr: "سدّد الحد الأدنى على الأقل قبل تاريخ الاستحقاق، مثلاً عبر السداد التلقائي.",
    amountRule: { type: "fixed", amount: FEE_AMOUNTS.cardLate },
  },
  {
    code: FEE_CODES.islamicLateCharity,
    nameEn: "Late-payment charity amount",
    nameAr: "التبرع الخيري عن التأخر في السداد",
    descriptionEn:
      "When a payment is late on an Islamic card, this amount is collected and donated to charity. It is not income for the bank.",
    descriptionAr:
      "عند التأخر في السداد على البطاقة الإسلامية يُحصَّل هذا المبلغ ويُصرف في وجوه الخير، ولا يُعد دخلاً للبنك.",
    avoidTipEn: "Pay at least the minimum due before the due date.",
    avoidTipAr: "سدّد الحد الأدنى على الأقل قبل تاريخ الاستحقاق.",
    amountRule: { type: "fixed", amount: FEE_AMOUNTS.cardLate },
  },
  {
    code: FEE_CODES.cardCashAdvance,
    nameEn: "Cash withdrawal fee",
    nameAr: "رسوم السحب النقدي",
    descriptionEn: `A fee of ${FEE_AMOUNTS.cashAdvancePct}% of the amount (minimum QAR ${FEE_AMOUNTS.cashAdvanceMin}) when you withdraw cash with a credit card.`,
    descriptionAr: `رسوم بنسبة ${FEE_AMOUNTS.cashAdvancePct}٪ من المبلغ (بحد أدنى ${FEE_AMOUNTS.cashAdvanceMin} ر.ق) عند السحب النقدي ببطاقة الائتمان.`,
    avoidTipEn: "Withdraw cash with your debit card from your current account instead.",
    avoidTipAr: "استخدم بطاقة الخصم المباشر من حسابك الجاري للسحب النقدي بدلاً من ذلك.",
    amountRule: { type: "pct", pct: FEE_AMOUNTS.cashAdvancePct, min: FEE_AMOUNTS.cashAdvanceMin },
  },
  {
    code: FEE_CODES.cardFx,
    nameEn: "Foreign currency transaction fee",
    nameAr: "رسوم المعاملات بالعملة الأجنبية",
    descriptionEn: `A fee of ${FEE_AMOUNTS.fxPct}% on purchases made in a currency other than QAR, or with a merchant abroad.`,
    descriptionAr: `رسوم بنسبة ${FEE_AMOUNTS.fxPct}٪ على المشتريات بعملة غير الريال القطري أو لدى تاجر خارج قطر.`,
    avoidTipEn:
      "Check the currency before paying online; paying in QAR with a Qatar-based merchant avoids this fee.",
    avoidTipAr:
      "تحقّق من العملة قبل الدفع عبر الإنترنت؛ الدفع بالريال القطري لدى تاجر في قطر لا تترتب عليه هذه الرسوم.",
    amountRule: { type: "pct", pct: FEE_AMOUNTS.fxPct },
  },
  {
    code: FEE_CODES.cardOverlimit,
    nameEn: "Over-limit fee",
    nameAr: "رسوم تجاوز الحد الائتماني",
    descriptionEn: "Charged when the card balance goes above the credit limit.",
    descriptionAr: "تُحتسب عندما يتجاوز رصيد البطاقة الحد الائتماني.",
    avoidTipEn:
      "Keep spending below your credit limit, or check your available limit in the app before large purchases.",
    avoidTipAr:
      "حافظ على الإنفاق دون الحد الائتماني، أو تحقّق من الحد المتاح في التطبيق قبل المشتريات الكبيرة.",
    amountRule: { type: "fixed", amount: FEE_AMOUNTS.cardOverlimit },
  },
  {
    code: FEE_CODES.cardInterest,
    nameEn: "Interest charge",
    nameAr: "رسوم الفائدة",
    descriptionEn:
      "Interest on the part of your statement balance that was not paid in full by the due date.",
    descriptionAr: "فائدة على الجزء غير المسدَّد من رصيد الكشف بحلول تاريخ الاستحقاق.",
    avoidTipEn:
      "Paying the full statement balance by the due date means no interest is charged on purchases.",
    avoidTipAr: "سداد كامل رصيد الكشف بحلول تاريخ الاستحقاق يعني عدم احتساب فائدة على المشتريات.",
    amountRule: { type: "rate_on_balance" },
  },
  {
    code: FEE_CODES.cardProfit,
    nameEn: "Profit charge",
    nameAr: "رسوم الربح",
    descriptionEn:
      "Profit on the part of your statement balance that was not paid in full by the due date.",
    descriptionAr: "ربح على الجزء غير المسدَّد من رصيد الكشف بحلول تاريخ الاستحقاق.",
    avoidTipEn:
      "Paying the full statement balance by the due date means no profit is charged on purchases.",
    avoidTipAr: "سداد كامل رصيد الكشف بحلول تاريخ الاستحقاق يعني عدم احتساب ربح على المشتريات.",
    amountRule: { type: "rate_on_balance" },
  },
  {
    code: FEE_CODES.cardEppProcessing,
    nameEn: "Instalment plan processing fee",
    nameAr: "رسوم معالجة خطة التقسيط",
    descriptionEn: `A one-off fee of ${FEE_AMOUNTS.eppPct}% (minimum QAR ${FEE_AMOUNTS.eppMin}) when a purchase is converted into an instalment plan.`,
    descriptionAr: `رسوم لمرة واحدة بنسبة ${FEE_AMOUNTS.eppPct}٪ (بحد أدنى ${FEE_AMOUNTS.eppMin} ر.ق) عند تحويل عملية شراء إلى خطة تقسيط.`,
    avoidTipEn: "Paying the purchase in full by the statement due date avoids this fee.",
    avoidTipAr: "سداد قيمة الشراء كاملة بحلول تاريخ استحقاق الكشف يجنّبك هذه الرسوم.",
    amountRule: { type: "pct", pct: FEE_AMOUNTS.eppPct, min: FEE_AMOUNTS.eppMin },
  },
  {
    code: FEE_CODES.cardBalanceTransfer,
    nameEn: "Balance transfer fee",
    nameAr: "رسوم تحويل الرصيد",
    descriptionEn: `A one-off fee of ${FEE_AMOUNTS.balanceTransferPct}% of the amount transferred from another card.`,
    descriptionAr: `رسوم لمرة واحدة بنسبة ${FEE_AMOUNTS.balanceTransferPct}٪ من المبلغ المحوَّل من بطاقة أخرى.`,
    avoidTipEn: "Compare the fee with the charges you would otherwise pay before transferring.",
    avoidTipAr: "قارن هذه الرسوم بالتكاليف التي كنت ستدفعها بدون التحويل قبل إجرائه.",
    amountRule: { type: "pct", pct: FEE_AMOUNTS.balanceTransferPct },
  },
  {
    code: FEE_CODES.cardStatementCopy,
    nameEn: "Statement copy fee",
    nameAr: "رسوم نسخة الكشف",
    descriptionEn: "Charged for a printed copy of a past statement.",
    descriptionAr: "تُحتسب عند طلب نسخة مطبوعة من كشف سابق.",
    avoidTipEn: "Past statements can be downloaded in the app at no charge.",
    avoidTipAr: "يمكن تنزيل الكشوف السابقة من التطبيق دون رسوم.",
    amountRule: { type: "fixed", amount: FEE_AMOUNTS.cardStatementCopy },
  },
  {
    code: FEE_CODES.accMaintenance,
    nameEn: "Account maintenance fee",
    nameAr: "رسوم إدارة الحساب",
    descriptionEn:
      "A monthly fee when the account's average balance falls below the required minimum.",
    descriptionAr: "رسوم شهرية عندما ينخفض متوسط رصيد الحساب عن الحد الأدنى المطلوب.",
    avoidTipEn:
      "Keep the minimum average balance, or check whether a salary transfer waives this fee on your account.",
    avoidTipAr:
      "حافظ على الحد الأدنى لمتوسط الرصيد، أو تحقّق مما إذا كان تحويل الراتب يُعفي حسابك من هذه الرسوم.",
    amountRule: { type: "fixed", amount: FEE_AMOUNTS.accMaintenance },
  },
  {
    code: FEE_CODES.accChequeBook,
    nameEn: "Cheque book fee",
    nameAr: "رسوم دفتر الشيكات",
    descriptionEn: "Charged when a new cheque book is issued.",
    descriptionAr: "تُحتسب عند إصدار دفتر شيكات جديد.",
    avoidTipEn: "Transfers and standing orders in the app can replace many cheque payments.",
    avoidTipAr:
      "يمكن للتحويلات وأوامر الدفع المستديمة في التطبيق أن تحل محل كثير من المدفوعات بالشيكات.",
    amountRule: { type: "fixed", amount: FEE_AMOUNTS.accChequeBook },
  },
  {
    code: FEE_CODES.accSmsAlerts,
    nameEn: "SMS alerts fee",
    nameAr: "رسوم التنبيهات النصية",
    descriptionEn: "A quarterly fee for SMS transaction alerts.",
    descriptionAr: "رسوم ربع سنوية لتنبيهات المعاملات عبر الرسائل النصية.",
    avoidTipEn: "Push notifications in the app provide the same alerts at no charge.",
    avoidTipAr: "توفّر إشعارات التطبيق التنبيهات نفسها دون رسوم.",
    amountRule: { type: "fixed", amount: FEE_AMOUNTS.accSmsAlerts },
  },
  {
    code: FEE_CODES.atmOtherBank,
    nameEn: "Other-bank ATM fee",
    nameAr: "رسوم أجهزة الصراف التابعة لبنوك أخرى",
    descriptionEn: "Charged when you withdraw cash from an ATM that belongs to another bank.",
    descriptionAr: "تُحتسب عند السحب النقدي من جهاز صراف آلي تابع لبنك آخر.",
    avoidTipEn: "Use a Doha Demo Bank ATM; the app shows the nearest one.",
    avoidTipAr: "استخدم أجهزة صراف بنك الدوحة التجريبي؛ يعرض التطبيق أقرب جهاز.",
    amountRule: { type: "fixed", amount: FEE_AMOUNTS.atmOtherBank },
  },
  {
    code: FEE_CODES.accClosure,
    nameEn: "Account closure fee",
    nameAr: "رسوم إغلاق الحساب",
    descriptionEn: "Charged when an account is closed.",
    descriptionAr: "تُحتسب عند إغلاق الحساب.",
    avoidTipEn: "Check the account's terms for when this fee applies.",
    avoidTipAr: "راجع شروط الحساب لمعرفة متى تنطبق هذه الرسوم.",
    amountRule: { type: "fixed", amount: FEE_AMOUNTS.accClosure },
  },
];
