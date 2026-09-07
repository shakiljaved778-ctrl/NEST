import { getMarketDataService } from "@/services/market";
import { json, param } from "@/lib/market/http";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const q = param(req, "q") ?? "";
  const svc = getMarketDataService();
  const results = await svc.searchInstruments(q, 12);
  return json({ results });
}
