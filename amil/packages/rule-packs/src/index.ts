/** Rule pack keys (section 6 of the master prompt). Calculators arrive in Phase 2 and Phase 5. */
export const RULE_PACK_KEYS = [
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

export type RulePackKey = (typeof RULE_PACK_KEYS)[number];

export const PROACTIVE_RULE_PACK_KEYS: readonly RulePackKey[] = [
  "account.dormancy",
  "rewards.expiry",
];
