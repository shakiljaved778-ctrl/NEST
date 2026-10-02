/** Staff-facing names for packs, statuses and roles. */
export const PACK_LABELS: Record<string, string> = {
  "card.close": "Card closure",
  "finance.early_settlement": "Early settlement",
  "finance.top_up": "Finance top-up",
  "card.cash_withdrawal": "Cash withdrawal on card",
  "card.minimum_payment": "Minimum payment",
  "card.epp_conversion": "Instalment (EPP) conversion",
  "card.balance_transfer": "Balance transfer",
  "deposit.break": "Breaking a deposit",
  "salary.transfer_change": "Salary transfer change",
  "account.close": "Account closure",
  "account.dormancy": "Account dormancy",
  "rewards.expiry": "Rewards expiry",
  assistant: "Ask AMIL",
  "explain.charge": "Explain my charge",
};
export const packLabel = (key: string) => PACK_LABELS[key] ?? key;

export const STATUS_LABELS: Record<string, string> = {
  draft: "Draft",
  in_review: "In compliance review",
  compliance_approved: "Awaiting Sharia approval",
  approved: "Approved (live)",
  sharia_approved: "Sharia approved (live)",
  retired: "Retired",
};

export const ROLE_LABELS: Record<string, { title: string; can: string }> = {
  product: {
    title: "Product manager",
    can: "Edits pack parameters and drafts copy; uses kill switches. Cannot approve copy.",
  },
  compliance: {
    title: "Compliance officer",
    can: "Approves copy, searches and exports the audit log, runs complaints lookups.",
  },
  sharia: {
    title: "Sharia reviewer",
    can: "Gives the final approval for Islamic copy.",
  },
  admin: {
    title: "Platform admin",
    can: "Pack parameters, kill switches and the audit log. Approves nothing.",
  },
  viewer: { title: "Viewer", can: "Reads dashboards, packs, copy and the compliance pack." },
};

export const RESPONSE_LABELS: Record<string, string> = {
  continued: "Continued",
  chose_option: "Chose an option",
  talk_to_someone: "Talk to someone",
  dismissed: "Dismissed",
};

export const fmtDateTime = (iso: string) =>
  new Date(iso).toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Qatar",
  });
export const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Qatar",
  });
