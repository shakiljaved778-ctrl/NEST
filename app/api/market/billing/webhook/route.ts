/**
 * Billing webhook stub (Stripe / Paddle).
 *
 * Wire the real integration here: verify the signature, then flip the user's
 * Subscription record (free ↔ premium, trial flags, renewalDate) in Postgres.
 * Left as a no-op stub so the demo makes NO external calls.
 */
import { json } from "@/lib/market/http";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const provider = process.env.BILLING_PROVIDER ?? "stripe";

  // TODO(stripe): verify with STRIPE_WEBHOOK_SECRET using stripe.webhooks.constructEvent
  //   const sig = req.headers.get("stripe-signature");
  //   const event = stripe.webhooks.constructEvent(rawBody, sig, secret);
  //   switch (event.type) {
  //     case "checkout.session.completed": /* set subscription = premium */ break;
  //     case "customer.subscription.deleted": /* set subscription = free */ break;
  //   }
  //
  // TODO(paddle): verify with PADDLE_WEBHOOK_SECRET, handle subscription.* events.

  const bodyPreview = await req.text().catch(() => "");
  // eslint-disable-next-line no-console
  console.info(`[billing] ${provider} webhook received (stub, ignored)`, bodyPreview.slice(0, 120));

  return json({ received: true, handled: false, note: "Billing webhook is a stub." });
}
