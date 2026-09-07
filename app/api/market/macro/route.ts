import { getMarketDataService } from "@/services/market";
import { json, notFound, param } from "@/lib/market/http";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const id = param(req, "id");
  const svc = getMarketDataService();
  if (id) {
    const series = await svc.getMacroSeries(id);
    if (!series) return notFound(`unknown macro series: ${id}`);
    return json({ series, isMock: svc.isMock });
  }
  const series = await svc.listMacroSeries();
  return json({ series, isMock: svc.isMock });
}
