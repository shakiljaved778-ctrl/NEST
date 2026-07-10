import { NextRequest, NextResponse } from "next/server";
import { COUPONS } from "@/lib/pricing";
import { creditWallet, debitWallet, walletBalance, walletTransactions } from "@/lib/wallet";

/** GET /api/wallet?customer=… — balance, ledger and active coupons. */
export function GET(req: NextRequest) {
  const customer = req.nextUrl.searchParams.get("customer") ?? "demo";
  return NextResponse.json({
    customer,
    balance: walletBalance(customer),
    transactions: walletTransactions(customer),
    coupons: Object.entries(COUPONS).map(([code, c]) => ({ code, ...c })),
  });
}

/** POST /api/wallet — credit ({customer, type, amount, note}) or debit ({customer, debit:true, amount, note}). */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    if (!body.customer || body.amount === undefined) {
      return NextResponse.json({ error: "customer and amount are required" }, { status: 400 });
    }
    const tx = body.debit
      ? debitWallet(String(body.customer), Number(body.amount), String(body.note ?? "Wallet payment"))
      : creditWallet(String(body.customer), body.type ?? "topup", Number(body.amount), String(body.note ?? "Top-up"));
    return NextResponse.json({ transaction: tx, balance: walletBalance(String(body.customer)) }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
}
