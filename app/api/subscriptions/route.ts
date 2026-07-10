import { NextRequest, NextResponse } from "next/server";
import { activeSubscription, cancelSubscription, PLANS, subscribe } from "@/lib/subscriptions";
import { trackEvent } from "@/lib/analytics";

/** GET /api/subscriptions?customer=… — plans + the customer's active subscription. */
export function GET(req: NextRequest) {
  const customer = req.nextUrl.searchParams.get("customer");
  return NextResponse.json({
    plans: PLANS,
    subscription: customer ? (activeSubscription(customer) ?? null) : null,
  });
}

/** POST /api/subscriptions — subscribe ({customer, planId}) or cancel ({subscriptionId, cancel:true}). */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    if (body.cancel) {
      if (!body.subscriptionId) return NextResponse.json({ error: "subscriptionId is required" }, { status: 400 });
      return NextResponse.json({ subscription: cancelSubscription(String(body.subscriptionId)) });
    }
    if (!body.customer || !body.planId) {
      return NextResponse.json({ error: "customer and planId are required" }, { status: 400 });
    }
    const subscription = subscribe(String(body.customer), String(body.planId));
    trackEvent("subscription_started", String(body.customer), { planId: subscription.planId });
    return NextResponse.json({ subscription }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
}
