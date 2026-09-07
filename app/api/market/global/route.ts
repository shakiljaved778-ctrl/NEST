import { getMarketDataService } from "@/services/market";
import { json, planFromRequest } from "@/lib/market/http";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const plan = planFromRequest(req);
  const svc = getMarketDataService();
  const tiles = await svc.getGlobalMacro(plan);
  return json({ tiles, isMock: svc.isMock });
}
