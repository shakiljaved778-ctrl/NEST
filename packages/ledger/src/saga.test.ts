import { describe, it, expect } from "vitest";
import { Saga, type SagaStep } from "./saga.js";

interface Ctx {
  log: string[];
  failAt?: string;
}

function step(name: string): SagaStep<Ctx> {
  return {
    name,
    idempotencyKey: () => name,
    execute: async (ctx) => {
      if (ctx.failAt === name) throw new Error(`boom at ${name}`);
      ctx.log.push(`do:${name}`);
    },
    compensate: async (ctx) => {
      ctx.log.push(`undo:${name}`);
    },
  };
}

describe("checkout saga", () => {
  const steps = [step("reserveHold"), step("chargePayment"), step("confirmSegment")];

  it("runs all steps forward on success", async () => {
    const saga = new Saga<Ctx>("s1", steps);
    const ctx: Ctx = { log: [] };
    const res = await saga.run(ctx);
    expect(res.ok).toBe(true);
    expect(ctx.log).toEqual(["do:reserveHold", "do:chargePayment", "do:confirmSegment"]);
    expect(res.compensated).toEqual([]);
  });

  it("compensates completed steps in reverse when a later step fails", async () => {
    const saga = new Saga<Ctx>("s2", steps);
    const ctx: Ctx = { log: [], failAt: "confirmSegment" };
    const res = await saga.run(ctx);
    expect(res.ok).toBe(false);
    expect(res.failedStep).toBe("confirmSegment");
    // reserveHold and chargePayment ran, then undo in reverse order
    expect(ctx.log).toEqual([
      "do:reserveHold",
      "do:chargePayment",
      "undo:chargePayment",
      "undo:reserveHold",
    ]);
    expect(res.compensated).toEqual(["chargePayment", "reserveHold"]);
  });

  it("is idempotent: re-running does not re-apply an already-applied step", async () => {
    const saga = new Saga<Ctx>("s3", [step("reserveHold")]);
    const ctx: Ctx = { log: [] };
    await saga.run(ctx);
    await saga.run(ctx);
    expect(ctx.log.filter((l) => l === "do:reserveHold")).toHaveLength(1);
  });
});
