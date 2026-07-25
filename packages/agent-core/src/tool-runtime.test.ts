import { describe, it, expect } from "vitest";
import { ToolRuntime, MoneyGateError, AutonomyCapError } from "./tool-runtime.js";
import { InMemoryAuditSink } from "./audit.js";
import { TOOLS } from "@voyara/contracts";

function bookHandler() {
  return async () => ({
    bookingId: "bk_1",
    status: "CONFIRMED",
    pnrRefs: { hotel: "PNR123" },
    totalCharged: { amountMinor: 35400, currency: "USD" },
    walletApplied: { amountMinor: 0, currency: "USD" },
  });
}

const validBookInput = {
  tripOptionId: "opt_ist-01",
  userId: "u1",
  holdTokens: ["hold_1"],
  paymentMandate: "pm_tok_test",
  applyWallet: true,
};

describe("MONEY-gate enforcement (in the runtime, not the prompt)", () => {
  it("blocks a MONEY tool at WATCH tier without approval", async () => {
    const rt = new ToolRuntime(new InMemoryAuditSink());
    await expect(
      rt.execute(TOOLS.book_trip, validBookInput, bookHandler(), {
        actorType: "AGENT",
        tier: "WATCH",
      }),
    ).rejects.toBeInstanceOf(MoneyGateError);
  });

  it("blocks a MONEY tool at ASK tier without approval", async () => {
    const rt = new ToolRuntime(new InMemoryAuditSink());
    await expect(
      rt.execute(TOOLS.book_trip, validBookInput, bookHandler(), {
        actorType: "AGENT",
        tier: "ASK",
      }),
    ).rejects.toBeInstanceOf(MoneyGateError);
  });

  it("allows a MONEY tool when the user explicitly approves", async () => {
    const rt = new ToolRuntime(new InMemoryAuditSink());
    const out = await rt.execute(TOOLS.book_trip, validBookInput, bookHandler(), {
      actorType: "USER",
      tier: "ASK",
      userApproved: true,
    });
    expect(out.status).toBe("CONFIRMED");
  });

  it("allows ACT-tier auto-exec within the cap, blocks over the cap", async () => {
    const rt = new ToolRuntime(new InMemoryAuditSink());
    const okCtx = { actorType: "AGENT" as const, tier: "ACT" as const, actCapMinor: 40000, amountMinor: 35400 };
    await expect(
      rt.execute(TOOLS.book_trip, validBookInput, bookHandler(), okCtx),
    ).resolves.toBeTruthy();

    await expect(
      rt.execute(TOOLS.book_trip, validBookInput, bookHandler(), {
        actorType: "AGENT",
        tier: "ACT",
        actCapMinor: 10000,
        amountMinor: 35400,
      }),
    ).rejects.toBeInstanceOf(AutonomyCapError);
  });

  it("writes an audit record BEFORE the side effect", async () => {
    const sink = new InMemoryAuditSink();
    const rt = new ToolRuntime(sink);
    await rt.execute(TOOLS.get_trip_status, { tripId: "t1" }, async () => ({
      tripId: "t1",
      status: "LIVE",
      segments: [{ kind: "HOTEL", status: "CONFIRMED" }],
    }), { actorType: "USER", tier: "WATCH" });
    const rows = sink.all();
    expect(rows[0]?.action).toBe("invoke:get_trip_status");
    expect(rows[1]?.action).toBe("result:get_trip_status");
    expect(rows[0]?.outputHash).toBeUndefined();
  });
});
