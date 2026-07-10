/**
 * Nest Wallet — customer credit ledger (guarantee & fintech stream).
 * Balance is derived from the transaction ledger, never stored directly,
 * so it always reconciles. Credits come from refunds-to-wallet, rating
 * rewards and promotions; debits from wallet payments.
 */

export type WalletTxType = "topup" | "refund_credit" | "reward" | "promo" | "payment";

export interface WalletTransaction {
  id: string;
  customer: string;
  type: WalletTxType;
  /** Positive = credit, negative = debit (QAR). */
  amount: number;
  note: string;
  createdAt: string;
}

declare global {
  // eslint-disable-next-line no-var
  var __nestWallet: WalletTransaction[] | undefined;
}

function ledger(): WalletTransaction[] {
  if (!globalThis.__nestWallet) {
    // Seed matching the customer-app demo: QAR 120 balance incl. a rating reward.
    globalThis.__nestWallet = [
      { id: "WT-1", customer: "demo", type: "promo", amount: 105, note: "Welcome credit — The Pearl launch", createdAt: new Date(Date.now() - 6 * 86400000).toISOString() },
      { id: "WT-2", customer: "demo", type: "reward", amount: 15, note: "Rating reward — 5★ review", createdAt: new Date(Date.now() - 86400000).toISOString() },
    ];
  }
  return globalThis.__nestWallet;
}

export function walletBalance(customer: string): number {
  return ledger()
    .filter((t) => t.customer === customer)
    .reduce((sum, t) => sum + t.amount, 0);
}

export function walletTransactions(customer: string): WalletTransaction[] {
  return ledger()
    .filter((t) => t.customer === customer)
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}

export function creditWallet(customer: string, type: Exclude<WalletTxType, "payment">, amount: number, note: string): WalletTransaction {
  if (amount <= 0) throw new Error("Credit amount must be positive");
  const tx: WalletTransaction = {
    id: `WT-${ledger().length + 1}`,
    customer,
    type,
    amount,
    note,
    createdAt: new Date().toISOString(),
  };
  ledger().push(tx);
  return tx;
}

export function debitWallet(customer: string, amount: number, note: string): WalletTransaction {
  if (amount <= 0) throw new Error("Debit amount must be positive");
  if (walletBalance(customer) < amount) throw new Error("Insufficient wallet balance");
  const tx: WalletTransaction = {
    id: `WT-${ledger().length + 1}`,
    customer,
    type: "payment",
    amount: -amount,
    note,
    createdAt: new Date().toISOString(),
  };
  ledger().push(tx);
  return tx;
}
