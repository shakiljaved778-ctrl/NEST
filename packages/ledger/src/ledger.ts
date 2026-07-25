import { type Money, type PostingDirection, money } from "@voyara/contracts";

/**
 * Double-entry ledger. Every movement is TWO postings that sum to zero.
 * Balance is DERIVED from postings, never stored as the source of truth.
 */
export interface Posting {
  id: string;
  txId: string;
  accountId: string;
  amountMinor: number; // signed: DEBIT negative, CREDIT positive by convention below
  direction: PostingDirection;
  currency: string;
  memo: string;
  createdAt: string;
}

export interface Transaction {
  txId: string;
  postings: Posting[];
}

let _seq = 0;
function nextId(prefix: string): string {
  _seq += 1;
  return `${prefix}_${Date.now().toString(36)}_${_seq}`;
}

/**
 * Build a balanced transfer between two accounts. Returns two postings whose
 * signed amounts sum to zero. Throws if amount is not an integer.
 */
export function transfer(params: {
  from: string;
  to: string;
  amount: Money;
  memo: string;
  txId?: string;
}): Transaction {
  const { from, to, amount, memo } = params;
  if (!Number.isInteger(amount.amountMinor)) {
    throw new Error("Ledger amounts must be integer minor units");
  }
  const txId = params.txId ?? nextId("tx");
  const now = new Date().toISOString();
  const debit: Posting = {
    id: nextId("post"),
    txId,
    accountId: from,
    amountMinor: -amount.amountMinor,
    direction: "DEBIT",
    currency: amount.currency,
    memo,
    createdAt: now,
  };
  const credit: Posting = {
    id: nextId("post"),
    txId,
    accountId: to,
    amountMinor: amount.amountMinor,
    direction: "CREDIT",
    currency: amount.currency,
    memo,
    createdAt: now,
  };
  return { txId, postings: [debit, credit] };
}

/** A transaction is valid iff its signed postings sum to exactly zero. */
export function isBalanced(tx: Transaction): boolean {
  return tx.postings.reduce((s, p) => s + p.amountMinor, 0) === 0;
}

/** Derive an account balance from a posting log. Never stored. */
export function deriveBalance(
  postings: Posting[],
  accountId: string,
  currency: string,
): Money {
  const total = postings
    .filter((p) => p.accountId === accountId && p.currency === currency)
    .reduce((s, p) => s + p.amountMinor, 0);
  return money(total, currency);
}

/** In-memory double-entry book. In prod, postings persist to Postgres. */
export class Ledger {
  private readonly postings: Posting[] = [];

  post(tx: Transaction): void {
    if (!isBalanced(tx)) {
      throw new Error(`Refusing unbalanced transaction ${tx.txId}`);
    }
    this.postings.push(...tx.postings);
  }

  balance(accountId: string, currency = "USD"): Money {
    return deriveBalance(this.postings, accountId, currency);
  }

  all(): readonly Posting[] {
    return this.postings;
  }
}
