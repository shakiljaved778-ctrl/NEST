/**
 * Nest+ subscriptions — recurring home-care plans and annual maintenance
 * contracts (revenue stream 2). Plan discounts feed the pricing engine's
 * `nestPlus` flag at quote time.
 */

export interface Plan {
  id: string;
  name: string;
  nameAr: string;
  priceMonthly: number; // QAR
  discountRate: number; // applied to every booking
  features: string[];
  popular?: boolean;
}

export const PLANS: Plan[] = [
  {
    id: "nest-essential",
    name: "Nest+ Essential",
    nameAr: "نست+ أساسي",
    priceMonthly: 199,
    discountRate: 0.1,
    features: ["2 cleans / month", "10% off all services", "Priority slots"],
  },
  {
    id: "nest-family",
    name: "Nest+ Family",
    nameAr: "نست+ عائلي",
    priceMonthly: 449,
    discountRate: 0.15,
    features: ["4 cleans / month", "1 AC service / quarter", "15% off · family profiles"],
    popular: true,
  },
  {
    id: "villa-amc",
    name: "Villa AMC",
    nameAr: "عقد صيانة الفيلا",
    priceMonthly: 899,
    discountRate: 0.15,
    features: ["Annual maintenance contract", "AC + plumbing + electrical cover", "48h SLA with rework guarantee"],
  },
];

export type SubscriptionStatus = "active" | "cancelled";

export interface Subscription {
  id: string;
  customer: string;
  planId: string;
  status: SubscriptionStatus;
  startedAt: string;
  cancelledAt?: string;
  renewsAt: string;
}

declare global {
  // eslint-disable-next-line no-var
  var __nestSubscriptions: Subscription[] | undefined;
}

function subs(): Subscription[] {
  if (!globalThis.__nestSubscriptions) globalThis.__nestSubscriptions = [];
  return globalThis.__nestSubscriptions;
}

export function getPlan(planId: string): Plan | undefined {
  return PLANS.find((p) => p.id === planId);
}

export function subscribe(customer: string, planId: string, now = new Date()): Subscription {
  const plan = getPlan(planId);
  if (!plan) throw new Error(`Unknown plan: ${planId}`);
  if (activeSubscription(customer)) throw new Error("Customer already has an active plan");

  const renews = new Date(now);
  renews.setMonth(renews.getMonth() + 1);
  const sub: Subscription = {
    id: `SUB-${100 + subs().length}`,
    customer,
    planId,
    status: "active",
    startedAt: now.toISOString(),
    renewsAt: renews.toISOString(),
  };
  subs().push(sub);
  return sub;
}

export function cancelSubscription(subscriptionId: string, now = new Date()): Subscription {
  const sub = subs().find((s) => s.id === subscriptionId);
  if (!sub) throw new Error(`Unknown subscription: ${subscriptionId}`);
  if (sub.status === "cancelled") throw new Error("Subscription already cancelled");
  sub.status = "cancelled";
  sub.cancelledAt = now.toISOString();
  return sub;
}

export function activeSubscription(customer: string): Subscription | undefined {
  return subs().find((s) => s.customer === customer && s.status === "active");
}

/** Booking discount rate for a customer (0 when not subscribed). */
export function discountRateFor(customer: string): number {
  const sub = activeSubscription(customer);
  return sub ? (getPlan(sub.planId)?.discountRate ?? 0) : 0;
}

export function listSubscriptions(): Subscription[] {
  return [...subs()];
}
