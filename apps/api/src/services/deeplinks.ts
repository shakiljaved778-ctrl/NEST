import type { AnyFactSet, OptionKey } from "@amil/rules-engine";

/**
 * Options are deep links back into the bank's own app (non-negotiable 3): AMIL never executes
 * anything. Paths are relative to the bank's configured scheme (Bank.deepLinkScheme, "ddb://").
 * `{name}` is filled from the check context (cardId, amount, …) or, failing that, from a fact.
 */
const PATHS: Record<OptionKey, string> = {
  // card.close
  redeem_points: "cards/{cardId}/rewards",
  view_instalments: "cards/{cardId}/instalments",
  continue_closure: "cards/{cardId}/close/confirm",
  // finance.early_settlement
  settle_now: "finance/{financeId}/settle/confirm",
  schedule_settlement: "finance/{financeId}/settle/schedule?date={cheapestSettlementDate}",
  partial_prepayment: "finance/{financeId}/prepay",
  // finance.top_up
  choose_shorter_tenor: "finance/{financeId}/top-up?amount={topUpAmount}&months={remainingMonths}",
  continue_top_up:
    "finance/{financeId}/top-up/confirm?amount={topUpAmount}&months={newTenorMonths}",
  // card.cash_withdrawal
  use_debit_card: "accounts/withdraw?amount={withdrawalAmount}",
  continue_withdrawal: "cards/{cardId}/cash/confirm?amount={withdrawalAmount}",
  // card.minimum_payment
  pay_statement_balance: "cards/{cardId}/pay/confirm?amount={statementBalance}",
  pay_custom_amount: "cards/{cardId}/pay",
  continue_minimum_payment: "cards/{cardId}/pay/confirm?amount={minimumDue}",
  // card.epp_conversion
  pay_in_full: "cards/{cardId}/pay",
  continue_epp:
    "cards/{cardId}/instalments/convert/confirm?transactionId={transactionId}&months={planMonths}",
  // card.balance_transfer
  adjust_transfer_amount: "cards/{cardId}/balance-transfer",
  continue_balance_transfer: "cards/{cardId}/balance-transfer/confirm?amount={transferAmount}",
  // deposit.break
  keep_until_maturity: "deposits/{depositId}",
  continue_break: "deposits/{depositId}/break/confirm",
  // salary.transfer_change
  view_linked_benefits: "salary/linked",
  continue_salary_change: "salary/change/confirm",
  // account.close
  review_standing_orders: "accounts/{accountId}/standing-orders",
  continue_account_close: "accounts/{accountId}/close/confirm",
  // account.dormancy
  make_a_transaction: "accounts/{accountId}/transfer",
  // every pack
  talk_to_someone: "support/callback?topic={action}",
};

export type DeepLinkParams = { action: string } & Partial<
  Record<
    | "cardId"
    | "financeId"
    | "depositId"
    | "accountId"
    | "transactionId"
    | "amount"
    | "paymentAmount"
    | "months",
    string | number
  >
>;

export function deepLink(
  scheme: string,
  option: OptionKey,
  params: DeepLinkParams,
  facts: AnyFactSet | null,
): string {
  const path = PATHS[option].replace(/\{(\w+)\}/g, (_m, name: string) => {
    const fromContext = params[name as keyof DeepLinkParams];
    if (fromContext !== undefined) return encodeURIComponent(String(fromContext));
    const fact = facts?.[name];
    return fact && !Array.isArray(fact) ? encodeURIComponent(fact.value) : "";
  });
  return `${scheme}${path}`;
}

export function isOptionKey(key: string): key is OptionKey {
  return key in PATHS;
}
