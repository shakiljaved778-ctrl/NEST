import type { AnyFactSet, OptionKey } from "@amil/rules-engine";

/**
 * Options are deep links back into the bank's own app (non-negotiable 3): AMIL never executes
 * anything. Paths are relative to the bank's configured scheme (Bank.deepLinkScheme, "ddb://").
 */
const PATHS: Record<OptionKey, string> = {
  redeem_points: "cards/{cardId}/rewards",
  view_instalments: "cards/{cardId}/instalments",
  continue_closure: "cards/{cardId}/close/confirm",
  settle_now: "finance/{financeId}/settle/confirm",
  schedule_settlement: "finance/{financeId}/settle/schedule?date={cheapestSettlementDate}",
  partial_prepayment: "finance/{financeId}/prepay",
  talk_to_someone: "support/callback?topic={action}",
};

export function deepLink(
  scheme: string,
  option: OptionKey,
  params: { action: string; cardId?: string; financeId?: string },
  facts: AnyFactSet | null,
): string {
  const path = PATHS[option].replace(/\{(\w+)\}/g, (_m, name: string) => {
    if (name in params)
      return encodeURIComponent(String(params[name as keyof typeof params] ?? ""));
    const fact = facts?.[name];
    return fact && !Array.isArray(fact) ? encodeURIComponent(fact.value) : "";
  });
  return `${scheme}${path}`;
}

export function isOptionKey(key: string): key is OptionKey {
  return key in PATHS;
}
