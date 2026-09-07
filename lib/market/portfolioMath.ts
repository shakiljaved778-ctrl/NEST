/**
 * Pure portfolio valuation + P&L math. No I/O — takes holdings + a price map
 * and returns a fully computed {@link PortfolioValuation}. Kept pure so it is
 * trivially unit-testable and reusable server- or client-side.
 */
import type {
  Portfolio,
  PortfolioValuation,
  HoldingValuation,
  Quote,
  SectorId,
} from "@/types/market";
import { getInstrument, SECTOR_LABEL } from "@/lib/market/instruments";

export function valuePortfolio(
  portfolio: Portfolio,
  quotes: Record<string, Quote>,
): PortfolioValuation {
  const rows: HoldingValuation[] = [];
  let totalValue = 0;
  let totalCost = 0;
  let dayChange = 0;

  for (const h of portfolio.holdings) {
    const q = quotes[h.symbol];
    const inst = getInstrument(h.symbol);
    const price = q?.price ?? h.avgPrice;
    const marketValue = price * h.quantity;
    const costBasis = h.avgPrice * h.quantity;
    const prevClose = q?.prevClose ?? price;
    rows.push({
      holding: h,
      name: inst?.name ?? h.symbol,
      sector: inst?.sector,
      price,
      marketValue,
      costBasis,
      pnl: marketValue - costBasis,
      pnlPercent: costBasis ? ((marketValue - costBasis) / costBasis) * 100 : 0,
      weight: 0, // filled after total is known
    });
    totalValue += marketValue;
    totalCost += costBasis;
    dayChange += (price - prevClose) * h.quantity;
  }

  const investable = totalValue + portfolio.cash;
  for (const r of rows) {
    r.weight = investable ? (r.marketValue / investable) * 100 : 0;
  }
  rows.sort((a, b) => b.marketValue - a.marketValue);

  // Allocation by sector.
  const bySector = new Map<SectorId, number>();
  for (const r of rows) {
    if (!r.sector) continue;
    bySector.set(r.sector, (bySector.get(r.sector) ?? 0) + r.marketValue);
  }
  const allocationBySector = [...bySector.entries()]
    .map(([sector, value]) => ({
      sector,
      label: SECTOR_LABEL[sector],
      value,
      weight: totalValue ? (value / totalValue) * 100 : 0,
    }))
    .sort((a, b) => b.value - a.value);

  const prevValue = totalValue - dayChange;

  return {
    portfolioId: portfolio.id,
    totalValue,
    totalCost,
    cash: portfolio.cash,
    pnl: totalValue - totalCost,
    pnlPercent: totalCost ? ((totalValue - totalCost) / totalCost) * 100 : 0,
    dayChange,
    dayChangePercent: prevValue ? (dayChange / prevValue) * 100 : 0,
    rows,
    allocationBySector,
  };
}
