/**
 * The 25 synthetic customers of the fictional Doha Demo Bank.
 *
 * ALL DATA IS SYNTHETIC. Names are invented; phone numbers use the non-dialable "+974 0000"
 * range, emails use the reserved ".test" TLD, PANs start with 0000 and IBANs carry "00" check
 * digits, so none of them can collide with a real person, card or account.
 *
 * Day offsets are relative to the seed's `now` (see D-002). Money and rates are decimal strings.
 *
 * Rule-pack coverage map (each pack has at least 2 personas; verified by tests in Phase 5):
 *   card.close               khalid*, noura, hamad, mohammed, fatima
 *   finance.early_settlement fatima*, omar, layla, yousef, sanjay, faisal
 *   finance.top_up           omar, layla, sanjay, faisal
 *   card.cash_withdrawal     ravi, joseph, khalid (any active card with available limit)
 *   card.minimum_payment     ravi*, sara, joseph
 *   card.epp_conversion      hamad, sara, mohammed (recent large purchase)
 *   card.balance_transfer    ravi, sara, joseph (revolving balance)
 *   deposit.break            aisha*, mariam (Islamic), abdullah
 *   salary.transfer_change   omar*, sanjay, khalid, yousef
 *   account.close            hessa, ahmed, khalid (standing orders / cheques / linked products)
 *   account.dormancy         tariq, grace (inactive accounts nearing dormancy)
 *   rewards.expiry           khalid, noura, hamad, mohammed
 *   (* = named persona from the master prompt)
 * Consent: priya and ali have NOT granted consent (demonstrates non-negotiable 5).
 */

export type Variant = "conventional" | "islamic";
export type Locale = "en" | "ar";
export type CardTier = "classic" | "gold" | "platinum" | "signature";
export type SpendLevel = "low" | "mid" | "high";
export type PaymentHabit = "full" | "minimum" | "partial";

export interface StandingOrderSpec {
  payee: string;
  amount: string;
  frequency: "monthly" | "quarterly";
  nextRunInDays: number;
}

export interface AccountSpec {
  suffix: string;
  kind: "current" | "savings";
  variant: Variant;
  productName: string;
  balance: string;
  isSalaryAccount?: boolean;
  /** Days since the last customer-initiated activity (default 1). */
  lastActivityDaysAgo?: number;
  dormancyDays?: number;
  closureFee?: string;
  chequesOutstanding?: number;
  maintenanceFee?: string;
  maintenanceFeeWaived?: boolean;
  standingOrders?: StandingOrderSpec[];
  openedYearsAgo?: number;
}

export interface InstalmentPlanSpec {
  suffix: string;
  description: string;
  originalAmount: string;
  months: number;
  monthsRemaining: number;
}

export interface CardSpec {
  suffix: string;
  variant: Variant;
  tier: CardTier;
  productName: string;
  limit: string;
  balance: string;
  statementBalance: string;
  aprPct: string;
  annualFee: string;
  annualFeeChargedMonthsAgo?: number;
  annualFeeWaived?: boolean;
  supplementaryCount?: number;
  dueInDays: number;
  rewards?: {
    pointValueQar: string;
    buckets: { points: number; expiresInDays: number }[];
    pendingCashback?: string;
  };
  instalmentPlans?: InstalmentPlanSpec[];
  spend: SpendLevel;
  payment: PaymentHabit;
  foreignSpend?: boolean;
  cashAdvance?: { amount: string; daysAgo: number };
  latePayments?: number;
  overlimitFee?: boolean;
  largePurchase?: { amount: string; daysAgo: number; merchant: string; category: string };
}

export interface FinanceSpec {
  suffix: string;
  type: "conventional" | "murabaha" | "ijara";
  productName: string;
  originalPrincipal: string;
  ratePct: string;
  tenorMonths: number;
  monthsElapsed: number;
  nextDueInDays: number;
  salaryLinked?: boolean;
  cover?: { kind: "insurance" | "takaful"; premiumPaid: string };
}

export interface DepositSpec {
  suffix: string;
  variant: Variant;
  productName: string;
  principal: string;
  ratePct: string;
  termMonths: number;
  maturityInDays: number;
  autoRenew?: boolean;
}

export interface CustomerSpec {
  key: string;
  persona?: boolean;
  nameEn: string;
  nameAr: string;
  locale: Locale;
  segment: "mass" | "affluent" | "private";
  salaryTransfer: boolean;
  /** Monthly salary (credited to the salary account when salaryTransfer), or other income. */
  monthlyIncome: string;
  consent?: boolean;
  accounts: AccountSpec[];
  cards?: CardSpec[];
  finances?: FinanceSpec[];
  deposits?: DepositSpec[];
}

// Reusable synthetic product building blocks -----------------------------------------------------

const currentConv = (balance: string, extra: Partial<AccountSpec> = {}): AccountSpec => ({
  suffix: "current",
  kind: "current",
  variant: "conventional",
  productName: "Everyday Current Account",
  balance,
  ...extra,
});
const currentIsl = (balance: string, extra: Partial<AccountSpec> = {}): AccountSpec => ({
  suffix: "current",
  kind: "current",
  variant: "islamic",
  productName: "Islamic Current Account",
  balance,
  ...extra,
});
const savingsConv = (balance: string, extra: Partial<AccountSpec> = {}): AccountSpec => ({
  suffix: "savings",
  kind: "savings",
  variant: "conventional",
  productName: "Smart Savings Account",
  balance,
  ...extra,
});
const savingsIsl = (balance: string, extra: Partial<AccountSpec> = {}): AccountSpec => ({
  suffix: "savings",
  kind: "savings",
  variant: "islamic",
  productName: "Islamic Savings Account (Mudaraba)",
  balance,
  ...extra,
});

// Synthetic demo APRs / profit rates (annual percent).
const CONV_CARD_APR = "30.0000";
const ISL_CARD_PROFIT = "27.0000";

export const customers: CustomerSpec[] = [
  // 1 ── Khalid: flagship card.close (critical) ──────────────────────────────────────────────
  {
    key: "khalid",
    persona: true,
    nameEn: "Khalid Al-Mansoori",
    nameAr: "خالد المنصوري",
    locale: "en",
    segment: "affluent",
    salaryTransfer: true,
    monthlyIncome: "45000.00",
    accounts: [
      currentConv("38450.75", {
        isSalaryAccount: true,
        maintenanceFeeWaived: true,
        standingOrders: [
          {
            payee: "Villa rent (demo landlord)",
            amount: "12000.00",
            frequency: "monthly",
            nextRunInDays: 5,
          },
        ],
      }),
    ],
    cards: [
      {
        suffix: "platinum",
        variant: "conventional",
        tier: "platinum",
        productName: "DDB Platinum Rewards Credit Card",
        limit: "60000.00",
        balance: "6250.00",
        statementBalance: "4850.00",
        aprPct: CONV_CARD_APR,
        annualFee: "1500.00",
        annualFeeChargedMonthsAgo: 2,
        supplementaryCount: 1,
        dueInDays: 12,
        rewards: {
          pointValueQar: "0.0100",
          buckets: [
            { points: 8000, expiresInDays: 45 },
            { points: 34000, expiresInDays: 400 },
          ],
          pendingCashback: "0.00",
        },
        instalmentPlans: [
          {
            suffix: "laptop",
            description: "Instalment plan: West Bay Electronics (demo merchant)",
            originalAmount: "7200.00",
            months: 12,
            monthsRemaining: 6,
          },
        ],
        spend: "high",
        payment: "full",
        foreignSpend: true,
      },
    ],
  },
  // 2 ── Fatima: flagship finance.early_settlement (murabaha, ibra; cheaper in 19 days) ──────
  {
    key: "fatima",
    persona: true,
    nameEn: "Fatima Al-Kuwari",
    nameAr: "فاطمة الكواري",
    locale: "ar",
    segment: "affluent",
    salaryTransfer: true,
    monthlyIncome: "28000.00",
    accounts: [currentIsl("21300.40", { isSalaryAccount: true, maintenanceFeeWaived: true })],
    cards: [
      {
        suffix: "classic",
        variant: "islamic",
        tier: "classic",
        productName: "DDB Islamic Classic Card",
        limit: "15000.00",
        balance: "1320.00",
        statementBalance: "980.00",
        aprPct: ISL_CARD_PROFIT,
        annualFee: "0.00",
        dueInDays: 16,
        rewards: { pointValueQar: "0.0050", buckets: [{ points: 6400, expiresInDays: 300 }] },
        spend: "low",
        payment: "full",
      },
    ],
    finances: [
      {
        suffix: "murabaha",
        type: "murabaha",
        productName: "Personal Finance (Murabaha)",
        originalPrincipal: "120000.00",
        ratePct: "4.7500",
        tenorMonths: 48,
        monthsElapsed: 11,
        nextDueInDays: 19,
        cover: { kind: "takaful", premiumPaid: "1800.00" },
      },
    ],
  },
  // 3 ── Ravi: card.minimum_payment (pays minimum only, high utilisation) ───────────────────
  {
    key: "ravi",
    persona: true,
    nameEn: "Ravi Menon",
    nameAr: "رافي مينون",
    locale: "en",
    segment: "mass",
    salaryTransfer: true,
    monthlyIncome: "9500.00",
    accounts: [currentConv("2140.60", { isSalaryAccount: true, maintenanceFeeWaived: true })],
    cards: [
      {
        suffix: "gold",
        variant: "conventional",
        tier: "gold",
        productName: "DDB Gold Cashback Credit Card",
        limit: "20000.00",
        balance: "18420.00",
        statementBalance: "18150.00",
        aprPct: CONV_CARD_APR,
        annualFee: "500.00",
        annualFeeChargedMonthsAgo: 7,
        dueInDays: 9,
        rewards: { pointValueQar: "0.0100", buckets: [], pendingCashback: "45.20" },
        spend: "mid",
        payment: "minimum",
        cashAdvance: { amount: "1000.00", daysAgo: 55 },
        latePayments: 1,
      },
    ],
  },
  // 4 ── Aisha: deposit.break (critical, 9 days from maturity) ──────────────────────────────
  {
    key: "aisha",
    persona: true,
    nameEn: "Aisha Al-Thani",
    nameAr: "عائشة آل ثاني",
    locale: "ar",
    segment: "private",
    salaryTransfer: false,
    monthlyIncome: "60000.00",
    accounts: [currentConv("84210.00"), savingsConv("150000.00")],
    deposits: [
      {
        suffix: "term12",
        variant: "conventional",
        productName: "Fixed Term Deposit (12 months)",
        principal: "200000.00",
        ratePct: "4.2500",
        termMonths: 12,
        maturityInDays: 9,
      },
    ],
  },
  // 5 ── Omar: salary.transfer_change (salary-linked finance + fee waivers) ─────────────────
  {
    key: "omar",
    persona: true,
    nameEn: "Omar Haddad",
    nameAr: "عمر حداد",
    locale: "en",
    segment: "mass",
    salaryTransfer: true,
    monthlyIncome: "22000.00",
    accounts: [
      currentConv("9870.35", {
        isSalaryAccount: true,
        maintenanceFee: "25.00",
        maintenanceFeeWaived: true,
      }),
    ],
    cards: [
      {
        suffix: "gold",
        variant: "conventional",
        tier: "gold",
        productName: "DDB Gold Credit Card",
        limit: "25000.00",
        balance: "3120.00",
        statementBalance: "2700.00",
        aprPct: CONV_CARD_APR,
        annualFee: "500.00",
        annualFeeWaived: true,
        dueInDays: 20,
        spend: "mid",
        payment: "full",
      },
    ],
    finances: [
      {
        suffix: "personal",
        type: "conventional",
        productName: "Salary-Linked Personal Loan",
        originalPrincipal: "150000.00",
        ratePct: "5.9900",
        tenorMonths: 60,
        monthsElapsed: 18,
        nextDueInDays: 7,
        salaryLinked: true,
        cover: { kind: "insurance", premiumPaid: "2250.00" },
      },
    ],
  },
  // 6 ── Noura: rewards.expiry (points expiring in 20 days), card.close ─────────────────────
  {
    key: "noura",
    nameEn: "Noura Al-Suwaidi",
    nameAr: "نورة السويدي",
    locale: "ar",
    segment: "affluent",
    salaryTransfer: true,
    monthlyIncome: "35000.00",
    accounts: [currentConv("27640.10", { isSalaryAccount: true, maintenanceFeeWaived: true })],
    cards: [
      {
        suffix: "signature",
        variant: "conventional",
        tier: "signature",
        productName: "DDB Signature Travel Credit Card",
        limit: "50000.00",
        balance: "4410.00",
        statementBalance: "3960.00",
        aprPct: CONV_CARD_APR,
        annualFee: "1000.00",
        annualFeeChargedMonthsAgo: 5,
        dueInDays: 14,
        rewards: {
          pointValueQar: "0.0100",
          buckets: [
            { points: 6000, expiresInDays: 20 },
            { points: 12500, expiresInDays: 380 },
          ],
        },
        spend: "high",
        payment: "full",
        foreignSpend: true,
      },
    ],
  },
  // 7 ── Hamad: epp_conversion (large purchase), rewards.expiry (70 days), card.close ───────
  {
    key: "hamad",
    nameEn: "Hamad Al-Marri",
    nameAr: "حمد المري",
    locale: "ar",
    segment: "affluent",
    salaryTransfer: true,
    monthlyIncome: "40000.00",
    accounts: [currentConv("31275.00", { isSalaryAccount: true, maintenanceFeeWaived: true })],
    cards: [
      {
        suffix: "platinum",
        variant: "conventional",
        tier: "platinum",
        productName: "DDB Platinum Rewards Credit Card",
        limit: "45000.00",
        balance: "7980.00",
        statementBalance: "2950.00",
        aprPct: CONV_CARD_APR,
        annualFee: "1500.00",
        annualFeeChargedMonthsAgo: 9,
        dueInDays: 11,
        rewards: {
          pointValueQar: "0.0100",
          buckets: [
            { points: 5000, expiresInDays: 70 },
            { points: 20000, expiresInDays: 420 },
          ],
        },
        spend: "mid",
        payment: "full",
        largePurchase: {
          amount: "4800.00",
          daysAgo: 10,
          merchant: "Lusail Home Appliances (demo)",
          category: "electronics",
        },
      },
    ],
  },
  // 8 ── Yousef: Islamic ijara auto finance, salary transfer ───────────────────────────────
  {
    key: "yousef",
    nameEn: "Yousef Al-Kaabi",
    nameAr: "يوسف الكعبي",
    locale: "ar",
    segment: "mass",
    salaryTransfer: true,
    monthlyIncome: "26000.00",
    accounts: [currentIsl("12480.90", { isSalaryAccount: true, maintenanceFeeWaived: true })],
    cards: [
      {
        suffix: "gold",
        variant: "islamic",
        tier: "gold",
        productName: "DDB Islamic Gold Card",
        limit: "20000.00",
        balance: "2250.00",
        statementBalance: "1890.00",
        aprPct: ISL_CARD_PROFIT,
        annualFee: "400.00",
        annualFeeWaived: true,
        dueInDays: 18,
        spend: "mid",
        payment: "full",
      },
    ],
    finances: [
      {
        suffix: "ijara",
        type: "ijara",
        productName: "Auto Finance (Ijara)",
        originalPrincipal: "95000.00",
        ratePct: "3.9000",
        tenorMonths: 48,
        monthsElapsed: 20,
        nextDueInDays: 12,
        salaryLinked: true,
        cover: { kind: "takaful", premiumPaid: "3800.00" },
      },
    ],
  },
  // 9 ── Layla: Islamic murabaha, mid-tenor ─────────────────────────────────────────────────
  {
    key: "layla",
    nameEn: "Layla Haddad",
    nameAr: "ليلى حداد",
    locale: "en",
    segment: "mass",
    salaryTransfer: true,
    monthlyIncome: "18000.00",
    accounts: [currentIsl("6720.15", { isSalaryAccount: true, maintenanceFeeWaived: true })],
    finances: [
      {
        suffix: "murabaha",
        type: "murabaha",
        productName: "Personal Finance (Murabaha)",
        originalPrincipal: "60000.00",
        ratePct: "4.9500",
        tenorMonths: 60,
        monthsElapsed: 30,
        nextDueInDays: 4,
        cover: { kind: "takaful", premiumPaid: "1100.00" },
      },
    ],
  },
  // 10 ── Sanjay: salary-linked conventional loan ──────────────────────────────────────────
  {
    key: "sanjay",
    nameEn: "Sanjay Pillai",
    nameAr: "سانجاي بيلاي",
    locale: "en",
    segment: "mass",
    salaryTransfer: true,
    monthlyIncome: "15000.00",
    accounts: [
      currentConv("4310.80", {
        isSalaryAccount: true,
        maintenanceFee: "25.00",
        maintenanceFeeWaived: true,
      }),
    ],
    cards: [
      {
        suffix: "classic",
        variant: "conventional",
        tier: "classic",
        productName: "DDB Classic Credit Card",
        limit: "10000.00",
        balance: "1450.00",
        statementBalance: "1210.00",
        aprPct: CONV_CARD_APR,
        annualFee: "0.00",
        dueInDays: 6,
        spend: "low",
        payment: "full",
      },
    ],
    finances: [
      {
        suffix: "personal",
        type: "conventional",
        productName: "Salary-Linked Personal Loan",
        originalPrincipal: "80000.00",
        ratePct: "6.2500",
        tenorMonths: 48,
        monthsElapsed: 9,
        nextDueInDays: 15,
        salaryLinked: true,
        cover: { kind: "insurance", premiumPaid: "1200.00" },
      },
    ],
  },
  // 11 ── Sara: minimum payer, recent large purchase ───────────────────────────────────────
  {
    key: "sara",
    nameEn: "Sara Ibrahim",
    nameAr: "سارة إبراهيم",
    locale: "ar",
    segment: "mass",
    salaryTransfer: true,
    monthlyIncome: "14000.00",
    accounts: [currentConv("1985.40", { isSalaryAccount: true, maintenanceFeeWaived: true })],
    cards: [
      {
        suffix: "gold",
        variant: "conventional",
        tier: "gold",
        productName: "DDB Gold Credit Card",
        limit: "15000.00",
        balance: "11300.00",
        statementBalance: "8540.00",
        aprPct: CONV_CARD_APR,
        annualFee: "500.00",
        annualFeeChargedMonthsAgo: 4,
        dueInDays: 8,
        spend: "mid",
        payment: "minimum",
        largePurchase: {
          amount: "2600.00",
          daysAgo: 6,
          merchant: "Corniche Furniture (demo)",
          category: "home",
        },
      },
    ],
  },
  // 12 ── Joseph: minimum payer, high utilisation, over-limit history ──────────────────────
  {
    key: "joseph",
    nameEn: "Joseph Mathew",
    nameAr: "جوزيف ماثيو",
    locale: "en",
    segment: "mass",
    salaryTransfer: true,
    monthlyIncome: "7500.00",
    accounts: [currentConv("640.25", { isSalaryAccount: true, maintenanceFeeWaived: true })],
    cards: [
      {
        suffix: "classic",
        variant: "conventional",
        tier: "classic",
        productName: "DDB Classic Credit Card",
        limit: "8000.00",
        balance: "6820.00",
        statementBalance: "6600.00",
        aprPct: CONV_CARD_APR,
        annualFee: "0.00",
        dueInDays: 3,
        spend: "low",
        payment: "minimum",
        cashAdvance: { amount: "500.00", daysAgo: 100 },
        latePayments: 2,
        overlimitFee: true,
      },
    ],
  },
  // 13 ── Mariam: Islamic term investment (deposit.break, Islamic variant) ─────────────────
  {
    key: "mariam",
    nameEn: "Mariam Al-Nuaimi",
    nameAr: "مريم النعيمي",
    locale: "ar",
    segment: "affluent",
    salaryTransfer: true,
    monthlyIncome: "30000.00",
    accounts: [currentIsl("18900.00", { isSalaryAccount: true, maintenanceFeeWaived: true })],
    deposits: [
      {
        suffix: "wakala6",
        variant: "islamic",
        productName: "Term Investment (Wakala, 6 months)",
        principal: "50000.00",
        ratePct: "3.7500",
        termMonths: 6,
        maturityInDays: 60,
      },
    ],
  },
  // 14 ── Abdullah: conventional term deposit, longer to maturity ──────────────────────────
  {
    key: "abdullah",
    nameEn: "Abdullah Al-Sulaiti",
    nameAr: "عبدالله السليطي",
    locale: "ar",
    segment: "private",
    salaryTransfer: false,
    monthlyIncome: "50000.00",
    accounts: [currentConv("64200.00")],
    deposits: [
      {
        suffix: "term6",
        variant: "conventional",
        productName: "Fixed Term Deposit (6 months)",
        principal: "100000.00",
        ratePct: "4.0000",
        termMonths: 6,
        maturityInDays: 150,
        autoRenew: true,
      },
    ],
  },
  // 15 ── Hessa: account.close with standing orders and cheques outstanding ────────────────
  {
    key: "hessa",
    nameEn: "Hessa Al-Jaber",
    nameAr: "حصة الجابر",
    locale: "ar",
    segment: "mass",
    salaryTransfer: true,
    monthlyIncome: "25000.00",
    accounts: [
      currentConv("15630.00", {
        isSalaryAccount: true,
        maintenanceFeeWaived: true,
        chequesOutstanding: 3,
        standingOrders: [
          {
            payee: "School fees (demo school)",
            amount: "3500.00",
            frequency: "monthly",
            nextRunInDays: 3,
          },
          {
            payee: "Family support transfer",
            amount: "2000.00",
            frequency: "monthly",
            nextRunInDays: 11,
          },
        ],
      }),
    ],
  },
  // 16 ── Ahmed: account.close, current + savings, one standing order ──────────────────────
  {
    key: "ahmed",
    nameEn: "Ahmed Farouk",
    nameAr: "أحمد فاروق",
    locale: "en",
    segment: "mass",
    salaryTransfer: true,
    monthlyIncome: "16000.00",
    accounts: [
      currentConv("7340.55", {
        isSalaryAccount: true,
        maintenanceFeeWaived: true,
        chequesOutstanding: 1,
        standingOrders: [
          {
            payee: "Gym membership (demo club)",
            amount: "350.00",
            frequency: "monthly",
            nextRunInDays: 8,
          },
        ],
      }),
      savingsConv("12500.00", { lastActivityDaysAgo: 40 }),
    ],
    cards: [
      {
        suffix: "classic",
        variant: "conventional",
        tier: "classic",
        productName: "DDB Classic Credit Card",
        limit: "12000.00",
        balance: "980.00",
        statementBalance: "760.00",
        aprPct: CONV_CARD_APR,
        annualFee: "0.00",
        dueInDays: 10,
        spend: "low",
        payment: "full",
      },
    ],
  },
  // 17 ── Tariq: savings account 45 days from dormancy ─────────────────────────────────────
  {
    key: "tariq",
    nameEn: "Tariq Nasser",
    nameAr: "طارق ناصر",
    locale: "en",
    segment: "mass",
    salaryTransfer: true,
    monthlyIncome: "20000.00",
    accounts: [
      currentConv("8820.00", { isSalaryAccount: true, maintenanceFeeWaived: true }),
      savingsConv("23400.00", { lastActivityDaysAgo: 320, dormancyDays: 365 }),
    ],
  },
  // 18 ── Grace: current account 25 days from dormancy ─────────────────────────────────────
  {
    key: "grace",
    nameEn: "Grace Fernandes",
    nameAr: "غريس فرنانديز",
    locale: "en",
    segment: "mass",
    salaryTransfer: false,
    monthlyIncome: "8000.00",
    accounts: [
      currentConv("3150.00", {
        lastActivityDaysAgo: 340,
        dormancyDays: 365,
        maintenanceFee: "25.00",
      }),
      savingsConv("5400.00", { lastActivityDaysAgo: 2 }),
    ],
    cards: [
      {
        suffix: "classic",
        variant: "conventional",
        tier: "classic",
        productName: "DDB Classic Credit Card",
        limit: "6000.00",
        balance: "420.00",
        statementBalance: "380.00",
        aprPct: CONV_CARD_APR,
        annualFee: "0.00",
        dueInDays: 17,
        spend: "low",
        payment: "full",
      },
    ],
  },
  // 19 ── Mohammed: Islamic platinum, large purchase, points expiring in 80 days ───────────
  {
    key: "mohammed",
    nameEn: "Mohammed Al-Hajri",
    nameAr: "محمد الهاجري",
    locale: "ar",
    segment: "affluent",
    salaryTransfer: true,
    monthlyIncome: "38000.00",
    accounts: [currentIsl("22340.00", { isSalaryAccount: true, maintenanceFeeWaived: true })],
    cards: [
      {
        suffix: "platinum",
        variant: "islamic",
        tier: "platinum",
        productName: "DDB Islamic Platinum Card",
        limit: "50000.00",
        balance: "9120.00",
        statementBalance: "2870.00",
        aprPct: ISL_CARD_PROFIT,
        annualFee: "1200.00",
        annualFeeChargedMonthsAgo: 1,
        supplementaryCount: 2,
        dueInDays: 13,
        rewards: {
          pointValueQar: "0.0100",
          buckets: [
            { points: 12000, expiresInDays: 80 },
            { points: 9500, expiresInDays: 450 },
          ],
        },
        spend: "high",
        payment: "full",
        largePurchase: {
          amount: "6000.00",
          daysAgo: 12,
          merchant: "Al Waab Travel (demo)",
          category: "travel",
        },
      },
    ],
  },
  // 20 ── Reem: Islamic everyday banking ───────────────────────────────────────────────────
  {
    key: "reem",
    nameEn: "Reem Al-Ansari",
    nameAr: "ريم الأنصاري",
    locale: "ar",
    segment: "mass",
    salaryTransfer: true,
    monthlyIncome: "19000.00",
    accounts: [
      currentIsl("5230.70", { isSalaryAccount: true, maintenanceFeeWaived: true }),
      savingsIsl("14800.00", { lastActivityDaysAgo: 25 }),
    ],
    cards: [
      {
        suffix: "classic",
        variant: "islamic",
        tier: "classic",
        productName: "DDB Islamic Classic Card",
        limit: "10000.00",
        balance: "1760.00",
        statementBalance: "1420.00",
        aprPct: ISL_CARD_PROFIT,
        annualFee: "0.00",
        dueInDays: 19,
        spend: "low",
        payment: "partial",
        latePayments: 1,
      },
    ],
  },
  // 21 ── Faisal: conventional loan late in tenor ──────────────────────────────────────────
  {
    key: "faisal",
    nameEn: "Faisal Rahman",
    nameAr: "فيصل رحمن",
    locale: "en",
    segment: "mass",
    salaryTransfer: false,
    monthlyIncome: "21000.00",
    accounts: [currentConv("11240.00", { maintenanceFee: "25.00" })],
    cards: [
      {
        suffix: "gold",
        variant: "conventional",
        tier: "gold",
        productName: "DDB Gold Credit Card",
        limit: "18000.00",
        balance: "2680.00",
        statementBalance: "2310.00",
        aprPct: CONV_CARD_APR,
        annualFee: "500.00",
        annualFeeChargedMonthsAgo: 11,
        dueInDays: 21,
        spend: "mid",
        payment: "full",
        foreignSpend: true,
      },
    ],
    finances: [
      {
        suffix: "personal",
        type: "conventional",
        productName: "Personal Loan",
        originalPrincipal: "70000.00",
        ratePct: "7.2500",
        tenorMonths: 48,
        monthsElapsed: 40,
        nextDueInDays: 22,
      },
    ],
  },
  // 22 ── Priya: no consent recorded (generic information only) ────────────────────────────
  {
    key: "priya",
    nameEn: "Priya Nair",
    nameAr: "بريا ناير",
    locale: "en",
    segment: "mass",
    salaryTransfer: true,
    monthlyIncome: "11000.00",
    consent: false,
    accounts: [currentConv("3890.00", { isSalaryAccount: true, maintenanceFeeWaived: true })],
    cards: [
      {
        suffix: "classic",
        variant: "conventional",
        tier: "classic",
        productName: "DDB Classic Credit Card",
        limit: "7000.00",
        balance: "610.00",
        statementBalance: "540.00",
        aprPct: CONV_CARD_APR,
        annualFee: "0.00",
        dueInDays: 15,
        rewards: { pointValueQar: "0.0100", buckets: [{ points: 3000, expiresInDays: 30 }] },
        spend: "low",
        payment: "full",
      },
    ],
  },
  // 23 ── Nasser: private client, pending cashback ─────────────────────────────────────────
  {
    key: "nasser",
    nameEn: "Nasser Al-Khater",
    nameAr: "ناصر الخاطر",
    locale: "ar",
    segment: "private",
    salaryTransfer: true,
    monthlyIncome: "55000.00",
    accounts: [
      currentConv("96400.00", { isSalaryAccount: true, maintenanceFeeWaived: true }),
      savingsConv("240000.00", { lastActivityDaysAgo: 60 }),
    ],
    cards: [
      {
        suffix: "signature",
        variant: "conventional",
        tier: "signature",
        productName: "DDB Signature Cashback Credit Card",
        limit: "80000.00",
        balance: "12840.00",
        statementBalance: "10120.00",
        aprPct: CONV_CARD_APR,
        annualFee: "1000.00",
        annualFeeChargedMonthsAgo: 3,
        supplementaryCount: 1,
        dueInDays: 5,
        rewards: { pointValueQar: "0.0100", buckets: [], pendingCashback: "120.00" },
        spend: "high",
        payment: "full",
        foreignSpend: true,
      },
    ],
  },
  // 24 ── Dana: Islamic everyday banking ───────────────────────────────────────────────────
  {
    key: "dana",
    nameEn: "Dana Saleh",
    nameAr: "دانة صالح",
    locale: "ar",
    segment: "mass",
    salaryTransfer: true,
    monthlyIncome: "17000.00",
    accounts: [
      currentIsl("4420.00", { isSalaryAccount: true, maintenanceFeeWaived: true }),
      savingsIsl("9100.00", { lastActivityDaysAgo: 14 }),
    ],
    cards: [
      {
        suffix: "gold",
        variant: "islamic",
        tier: "gold",
        productName: "DDB Islamic Gold Card",
        limit: "16000.00",
        balance: "2140.00",
        statementBalance: "1980.00",
        aprPct: ISL_CARD_PROFIT,
        annualFee: "400.00",
        annualFeeChargedMonthsAgo: 6,
        dueInDays: 12,
        rewards: { pointValueQar: "0.0050", buckets: [{ points: 4200, expiresInDays: 210 }] },
        spend: "mid",
        payment: "full",
      },
    ],
  },
  // 25 ── Ali: no consent recorded ─────────────────────────────────────────────────────────
  {
    key: "ali",
    nameEn: "Ali Hassan",
    nameAr: "علي حسن",
    locale: "ar",
    segment: "mass",
    salaryTransfer: true,
    monthlyIncome: "24000.00",
    consent: false,
    accounts: [
      currentConv("10230.00", {
        isSalaryAccount: true,
        maintenanceFeeWaived: true,
        standingOrders: [
          { payee: "Car rental (demo)", amount: "1800.00", frequency: "monthly", nextRunInDays: 9 },
        ],
      }),
      savingsConv("32000.00", { lastActivityDaysAgo: 90 }),
    ],
    cards: [
      {
        suffix: "gold",
        variant: "conventional",
        tier: "gold",
        productName: "DDB Gold Credit Card",
        limit: "22000.00",
        balance: "3540.00",
        statementBalance: "3120.00",
        aprPct: CONV_CARD_APR,
        annualFee: "500.00",
        annualFeeChargedMonthsAgo: 8,
        dueInDays: 7,
        spend: "mid",
        payment: "full",
      },
    ],
  },
];
