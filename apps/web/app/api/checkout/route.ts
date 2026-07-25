import { runCheckout } from "@voyara/agent-core";
import { Accounts, transfer } from "@voyara/ledger";
import { money, type TripOption } from "@voyara/contracts";
import { runtime } from "@/lib/runtime";

export const dynamic = "force-dynamic";

/**
 * Sandbox checkout: runs the compensating saga across all segments against the
 * mock supplier, applies wallet, and posts double-entry ledger movements.
 * Card data never crosses this boundary — only a tokenized mandate.
 */
export async function POST(req: Request) {
  const body = (await req.json()) as {
    option: TripOption;
    userId?: string;
    applyWallet?: boolean;
  };
  const rt = runtime();
  const userId = body.userId ?? "demo-user";

  // Seed a small wallet credit once so the demo shows wallet-apply.
  const walletAcct = Accounts.userWallet(userId);
  if (rt.ledger.balance(walletAcct).amountMinor === 0) {
    rt.ledger.post(
      transfer({
        from: Accounts.voyaraRevenue("savings_fee"),
        to: walletAcct,
        amount: money(2500, "USD"),
        memo: "demo savings rebate",
      }),
    );
  }

  const result = await runCheckout(
    {
      option: body.option,
      userId,
      paymentMandate: "pm_tok_test_web",
      applyWallet: body.applyWallet ?? true,
      walletBalance: rt.ledger.balance(walletAcct),
    },
    {
      lodging: rt.lodging,
      air: rt.air,
      ledger: rt.ledger,
      charge: async () => {
        /* mock Stripe test charge — tokenized mandate only */
      },
    },
  );

  return Response.json({
    ...result,
    ledgerBalanced: rt.ledger.all().reduce((s, p) => s + p.amountMinor, 0) === 0,
  });
}
