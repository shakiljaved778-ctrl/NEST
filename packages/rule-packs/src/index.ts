export * from "./rules";
export * from "./define";
export * from "./template";
export * from "./templates";
export * from "./registry";
export * from "./card-close/types";
export * from "./card-close/calculate";
export * from "./finance-early-settlement/types";
export * from "./finance-early-settlement/calculate";
export * from "./shared/finance-math";
export * from "./top-up/pack";
export * from "./cash-withdrawal/pack";
export * from "./minimum-payment/pack";
export * from "./epp-conversion/pack";
export * from "./balance-transfer/pack";
export * from "./deposit-break/pack";
export * from "./salary-change/pack";
export * from "./account-close/pack";
export * from "./account-dormancy/pack";
export * from "./rewards-expiry/pack";

/** Rule pack keys (section 6 of the master prompt). */
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
