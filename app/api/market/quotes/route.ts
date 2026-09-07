import { getMarketDataService } from "@/services/market";
import { badRequest, json, param, planFromRequest } from "@/lib/market/http";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const symbols = param(req, "symbols");
  if (!symbols) return badRequest("symbols query param required (comma-separated)");
  const plan = planFromRequest(req);
  const svc = getMarketDataService();
  const list = symbols
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const quotes = await svc.getQuotes(list, plan);
  return json({ quotes, isMock: svc.isMock });
}
