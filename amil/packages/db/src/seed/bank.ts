/**
 * Doha Demo Bank: a FICTIONAL bank. All values are synthetic demo data, not real product terms.
 */

export const BANK_ID = "bank_ddb";

export const bank = {
  id: BANK_ID,
  name: "Doha Demo Bank",
  nameAr: "بنك الدوحة التجريبي",
  defaultLocale: "en",
  supportedLocales: ["en", "ar"],
  brandTokens: {
    primary: "#7a1f3d",
    primaryContrast: "#ffffff",
    accent: "#c9a227",
    surface: "#ffffff",
    surfaceMuted: "#f6f1f3",
    text: "#1f1a1c",
    textMuted: "#6b5f64",
    critical: "#b42318",
    caution: "#b54708",
    info: "#175cd3",
    radius: "14px",
    fontFamily: "'Inter', 'Noto Sans Arabic', system-ui, sans-serif",
  },
  deepLinkScheme: "ddb://",
  digitStyle: "latn",
  // Synthetic severity thresholds (QAR, as strings). Tuned per pack in Phase 2 and Phase 5.
  severityThresholds: {
    default: { cautionAtQar: "50.00", criticalAtQar: "250.00" },
    "card.close": { cautionAtQar: "50.00", criticalAtQar: "250.00" },
    "finance.early_settlement": { cautionAtQar: "100.00", criticalAtQar: "1000.00" },
    "deposit.break": { cautionAtQar: "100.00", criticalAtQar: "1000.00" },
  },
  modelMode: "redacted",
  currency: "QAR",
  auditRetentionYears: 10,
} as const;

export const consoleUsers = [
  { id: "cu_admin", email: "admin@ddb.example.test", name: "Demo Admin", role: "admin" },
  {
    id: "cu_product",
    email: "product@ddb.example.test",
    name: "Demo Product Owner",
    role: "product",
  },
  {
    id: "cu_compliance",
    email: "compliance@ddb.example.test",
    name: "Demo Compliance Officer",
    role: "compliance",
  },
  {
    id: "cu_sharia",
    email: "sharia@ddb.example.test",
    name: "Demo Sharia Reviewer",
    role: "sharia",
  },
  { id: "cu_viewer", email: "viewer@ddb.example.test", name: "Demo Viewer", role: "viewer" },
] as const;

export const proactiveJobs = [
  { rulePackKey: "account.dormancy", schedule: "0 6 * * *" },
  { rulePackKey: "rewards.expiry", schedule: "15 6 * * *" },
] as const;
