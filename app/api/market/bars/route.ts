import { getMarketDataService } from "@/services/market";
import { badRequest, json, param, planFromRequest } from "@/lib/market/http";
import { isValidSymbol } from "@/lib/market/instruments";
import type { Timeframe } from "@/types/market";

export const dynamic = "force-dynamic";

const TIMEFRAMES: Timeframe[] = ["1m", "5m", "15m", "1h", "1d"];

export async function GET(req: Request) {
  const symbol = param(req, "symbol");
  const tf = (param(req, "tf") ?? "1d") as Timeframe;
  if (!symbol) return badRequest("symbol query param required");
  if (!isValidSymbol(symbol)) return badRequest(`unknown symbol: ${symbol}`);
  if (!TIMEFRAMES.includes(tf)) return badRequest(`invalid timeframe: ${tf}`);

  const plan = planFromRequest(req);
  const svc = getMarketDataService();
  const bars = await svc.getHistoricalBars(symbol, tf, plan);
  const quote = await svc.getQuote(symbol, plan);
  return json({ symbol: symbol.toUpperCase(), timeframe: tf, bars, quote, isMock: svc.isMock });
}
