import { describe, it, expect } from "vitest";
import { Ledger, transfer, isBalanced, deriveBalance } from "./ledger.js";
import { Accounts } from "./accounts.js";
import { money } from "@voyara/contracts";

describe("double-entry ledger", () => {
  it("every transfer produces two postings that sum to zero", () => {
    const tx = transfer({
      from: Accounts.userCash("u1"),
      to: Accounts.supplierPayable("mock:ist-01"),
      amount: money(35400, "USD"),
      memo: "hotel charge",
    });
    expect(tx.postings).toHaveLength(2);
    expect(isBalanced(tx)).toBe(true);
    expect(tx.postings.reduce((s, p) => s + p.amountMinor, 0)).toBe(0);
  });

  it("refuses to post an unbalanced transaction", () => {
    const led = new Ledger();
    const bad = {
      txId: "x",
      postings: [
        { id: "1", txId: "x", accountId: "a", amountMinor: -100, direction: "DEBIT" as const, currency: "USD", memo: "", createdAt: "" },
        { id: "2", txId: "x", accountId: "b", amountMinor: 90, direction: "CREDIT" as const, currency: "USD", memo: "", createdAt: "" },
      ],
    };
    expect(() => led.post(bad)).toThrow();
  });

  it("balance is derived from postings, and a refund lands as wallet credit", () => {
    const led = new Ledger();
    led.post(
      transfer({
        from: Accounts.supplierPayable("mock:ist-01"),
        to: Accounts.userWallet("u1"),
        amount: money(4200, "USD"),
        memo: "price-drop refund credit",
      }),
    );
    expect(led.balance(Accounts.userWallet("u1")).amountMinor).toBe(4200);
    // whole book nets to zero
    const net = led.all().reduce((s, p) => s + p.amountMinor, 0);
    expect(net).toBe(0);
  });

  it("deriveBalance isolates account + currency", () => {
    const tx = transfer({
      from: "cash:u1",
      to: "wallet:u1",
      amount: money(1000, "USD"),
      memo: "",
    });
    expect(deriveBalance(tx.postings, "wallet:u1", "USD").amountMinor).toBe(1000);
    expect(deriveBalance(tx.postings, "wallet:u1", "EUR").amountMinor).toBe(0);
  });
});
