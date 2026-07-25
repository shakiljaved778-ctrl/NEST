/** Canonical chart-of-accounts helpers for the double-entry ledger. */
export const Accounts = {
  userWallet: (userId: string) => `wallet:${userId}`,
  userCash: (userId: string) => `cash:${userId}`, // external payment source
  supplierPayable: (supplierRef: string) => `supplier:${supplierRef}`,
  voyaraRevenue: (stream: RevenueStream) => `revenue:${stream}`,
  freezeExposure: (userId: string) => `freeze:${userId}`,
} as const;

export type RevenueStream =
  | "booking_margin"
  | "freeze_fee"
  | "membership"
  | "savings_fee"
  | "partner_fee";
