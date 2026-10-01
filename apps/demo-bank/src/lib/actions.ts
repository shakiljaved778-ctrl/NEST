import type { CheckAction, CheckContext } from "@amil/sdk";

/**
 * The demo bank's actions that AMIL checks before the bank's own confirmation, and where the
 * bank continues when AMIL has nothing to show (or is unavailable). AMIL never executes these.
 */
export const ACTIONS: Record<
  CheckAction,
  { confirm: (c: CheckContext) => string; back: (c: CheckContext) => string }
> = {
  "card.close": {
    confirm: (c) => `/cards/${c.cardId}/close/confirm`,
    back: (c) => `/cards/${c.cardId}`,
  },
  "finance.early_settlement": {
    confirm: (c) => `/finance/${c.financeId}/settle/confirm`,
    back: (c) => `/finance/${c.financeId}`,
  },
  "finance.top_up": {
    confirm: (c) => `/finance/${c.financeId}/top-up/confirm?amount=${c.amount}&months=${c.months}`,
    back: (c) => `/finance/${c.financeId}`,
  },
  "card.cash_withdrawal": {
    confirm: (c) => `/cards/${c.cardId}/cash/confirm?amount=${c.amount}`,
    back: (c) => `/cards/${c.cardId}`,
  },
  "card.minimum_payment": {
    confirm: (c) => `/cards/${c.cardId}/pay/confirm?minimum=1`,
    back: (c) => `/cards/${c.cardId}`,
  },
  "card.epp_conversion": {
    confirm: (c) =>
      `/cards/${c.cardId}/instalments/convert/confirm?transactionId=${c.transactionId}&months=${c.months}`,
    back: (c) => `/cards/${c.cardId}`,
  },
  "card.balance_transfer": {
    confirm: (c) => `/cards/${c.cardId}/balance-transfer/confirm?amount=${c.amount}`,
    back: (c) => `/cards/${c.cardId}`,
  },
  "deposit.break": {
    confirm: (c) => `/deposits/${c.depositId}/break/confirm`,
    back: (c) => `/deposits/${c.depositId}`,
  },
  "salary.transfer_change": {
    confirm: () => "/salary/change/confirm",
    back: () => "/settings",
  },
  "account.close": {
    confirm: (c) => `/accounts/${c.accountId}/close/confirm`,
    back: (c) => `/accounts/${c.accountId}`,
  },
};

export const isAction = (a: string): a is CheckAction => Object.hasOwn(ACTIONS, a);

const ID = /^[A-Za-z0-9._:-]{1,64}$/;
const AMOUNT = /^\d{1,9}(\.\d{1,2})?$/;

/** Read a check context from the flow page's query string (only well-formed values). */
export function contextFromQuery(q: Record<string, string | string[] | undefined>): CheckContext {
  const one = (k: string) => (typeof q[k] === "string" ? q[k] : undefined);
  const ctx: CheckContext = {};
  for (const k of ["cardId", "financeId", "depositId", "accountId", "transactionId"] as const) {
    const v = one(k);
    if (v && ID.test(v)) ctx[k] = v;
  }
  for (const k of ["amount", "paymentAmount"] as const) {
    const v = one(k);
    if (v && AMOUNT.test(v)) ctx[k] = v;
  }
  const months = Number(one("months"));
  if (Number.isInteger(months) && months > 0 && months <= 360) ctx.months = months;
  return ctx;
}

/** Link to the AMIL-checked flow for an action. */
export function actHref(action: CheckAction, ctx: CheckContext = {}): string {
  const q = new URLSearchParams(
    Object.entries(ctx).map(([k, v]) => [k, String(v)] as [string, string]),
  ).toString();
  return `/act/${action}${q ? `?${q}` : ""}`;
}
