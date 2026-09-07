import { getMarketDataService } from "@/services/market";
import { json } from "@/lib/market/http";

export const dynamic = "force-dynamic";

export async function GET() {
  const svc = getMarketDataService();
  const indices = await svc.getGCCIndices();
  return json({ indices, isMock: svc.isMock });
}
