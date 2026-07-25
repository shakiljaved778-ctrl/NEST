import { describe, it, expect } from "vitest";
import { McpRails, PartnerScopeError, listMcpTools, type ApiPartner } from "./index.js";
import { InMemoryAuditSink } from "@voyara/agent-core";
import { Ledger, Accounts } from "@voyara/ledger";

const partner: ApiPartner = {
  id: "atlas",
  name: "Atlas Assistant",
  scopes: ["search_trips", "book_trip"],
  perBookingFeeMinor: 500,
  rateLimit: 120,
};

const bookInput = {
  tripOptionId: "opt_1",
  userId: "u1",
  holdTokens: [],
  paymentMandate: "mandate_tok",
  applyWallet: true,
};

function bookHandler() {
  return async () => ({
    bookingId: "bk_1",
    status: "CONFIRMED",
    pnrRefs: { HOTEL: "PNR1" },
    totalCharged: { amountMinor: 29700, currency: "USD" },
    walletApplied: { amountMinor: 0, currency: "USD" },
  });
}

describe("MCP rails", () => {
  it("advertises the shared tool definitions from contracts", () => {
    const names = listMcpTools().map((t) => t.name);
    expect(names).toContain("search_trips");
    expect(names).toContain("book_trip");
  });

  it("rejects a tool the partner is not scoped for", async () => {
    const rails = new McpRails(new InMemoryAuditSink(), new Ledger());
    await expect(
      rails.invoke(partner, "cancel_booking", { bookingId: "b", userId: "u1" }, async () => ({
        bookingId: "b",
        refunded: { amountMinor: 0, currency: "USD" },
        status: "CANCELLED",
      }), { tier: "ACT" }),
    ).rejects.toBeInstanceOf(PartnerScopeError);
  });

  it("posts the per-booking partner fee through the ledger on book_trip", async () => {
    const ledger = new Ledger();
    const rails = new McpRails(new InMemoryAuditSink(), ledger);
    await rails.invoke(partner, "book_trip", bookInput, bookHandler(), {
      tier: "ACT",
      actCapMinor: 100000,
      amountMinor: 29700,
    });
    expect(ledger.balance(`partner:atlas`).amountMinor).toBe(500);
    expect(ledger.balance(Accounts.voyaraRevenue("partner_fee")).amountMinor).toBe(-500);
    expect(ledger.all().reduce((s, p) => s + p.amountMinor, 0)).toBe(0);
  });
});
