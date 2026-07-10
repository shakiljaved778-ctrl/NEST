import { beforeEach, describe, expect, it } from "vitest";
import { activeSubscription, cancelSubscription, discountRateFor, PLANS, subscribe } from "../lib/subscriptions";

beforeEach(() => {
  globalThis.__nestSubscriptions = undefined;
});

describe("Nest+ subscriptions", () => {
  it("offers the three launch plans matching the customer app", () => {
    expect(PLANS.map((p) => p.id)).toEqual(["nest-essential", "nest-family", "villa-amc"]);
    expect(PLANS.find((p) => p.id === "nest-family")?.popular).toBe(true);
  });

  it("subscribes a customer with a monthly renewal date", () => {
    const sub = subscribe("Amina", "nest-family");
    expect(sub.status).toBe("active");
    expect(new Date(sub.renewsAt).getTime()).toBeGreaterThan(new Date(sub.startedAt).getTime());
    expect(activeSubscription("Amina")?.id).toBe(sub.id);
  });

  it("prevents double subscriptions and unknown plans", () => {
    subscribe("Amina", "nest-essential");
    expect(() => subscribe("Amina", "nest-family")).toThrow(/already has an active plan/);
    expect(() => subscribe("Priya", "gold-plan")).toThrow(/Unknown plan/);
  });

  it("applies the plan discount to bookings and drops it on cancel", () => {
    expect(discountRateFor("Priya")).toBe(0);
    const sub = subscribe("Priya", "nest-essential");
    expect(discountRateFor("Priya")).toBe(0.1);
    cancelSubscription(sub.id);
    expect(discountRateFor("Priya")).toBe(0);
    expect(() => cancelSubscription(sub.id)).toThrow(/already cancelled/);
  });

  it("lets a customer re-subscribe after cancelling", () => {
    const sub = subscribe("James", "nest-essential");
    cancelSubscription(sub.id);
    const again = subscribe("James", "nest-family");
    expect(discountRateFor("James")).toBe(0.15);
    expect(again.id).not.toBe(sub.id);
  });
});
