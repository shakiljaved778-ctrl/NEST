import { getMarketDataService } from "@/services/market";
import { badRequest, json, param } from "@/lib/market/http";
import { getInstrument, isValidSymbol } from "@/lib/market/instruments";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const symbol = param(req, "symbol");
  if (!symbol) return badRequest("symbol query param required");
  if (!isValidSymbol(symbol)) return badRequest(`unknown symbol: ${symbol}`);
  const svc = getMarketDataService();
  const fundamentals = await svc.getFundamentals(symbol);
  return json({
    fundamentals,
    instrument: getInstrument(symbol),
    isMock: svc.isMock,
  });
}
