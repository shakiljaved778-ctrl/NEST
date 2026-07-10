import { beforeEach, describe, expect, it } from "vitest";
import { creditWallet, debitWallet, walletBalance, walletTransactions } from "../lib/wallet";

beforeEach(() => {
  globalThis.__nestWallet = undefined;
});

describe("Nest Wallet", () => {
  it("seeds the demo customer with QAR 120 matching the app UI", () => {
    expect(walletBalance("demo")).toBe(120);
    expect(walletTransactions("demo")).toHaveLength(2);
  });

  it("keeps ledgers separate per customer", () => {
    expect(walletBalance("someone-else")).toBe(0);
    creditWallet("someone-else", "topup", 50, "Card top-up");
    expect(walletBalance("someone-else")).toBe(50);
    expect(walletBalance("demo")).toBe(120);
  });

  it("credits and debits reconcile through the ledger", () => {
    creditWallet("demo", "refund_credit", 30, "Refund to wallet");
    debitWallet("demo", 100, "Paid booking NB-1050");
    expect(walletBalance("demo")).toBe(50);
    const txs = walletTransactions("demo");
    expect(txs[0].amount).toBe(-100); // newest first
  });

  it("blocks overdrafts and non-positive amounts", () => {
    expect(() => debitWallet("demo", 500, "too much")).toThrow(/Insufficient/);
    expect(() => creditWallet("demo", "topup", 0, "zero")).toThrow(/positive/);
    expect(() => debitWallet("demo", -5, "negative")).toThrow(/positive/);
  });
});
