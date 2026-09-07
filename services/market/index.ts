/**
 * Factory — resolves the active MarketDataService from env.
 *
 *   MARKET_DATA_PROVIDER=mock   (default) → MockMarketDataService
 *   MARKET_DATA_PROVIDER=real            → RealApiMarketDataService
 *
 * If `real` is selected but no key is configured, we fall back to the mock and
 * log a warning so the app always renders.
 */
import type { MarketDataService } from "./MarketDataService";
import { MockMarketDataService } from "./MockMarketDataService";
import { RealApiMarketDataService } from "./RealApiMarketDataService";

let instance: MarketDataService | null = null;

export function getMarketDataService(): MarketDataService {
  if (instance) return instance;

  const provider = (process.env.MARKET_DATA_PROVIDER ?? "mock").toLowerCase();

  if (provider === "real") {
    const key = process.env.MARKET_DATA_API_KEY;
    if (key) {
      instance = new RealApiMarketDataService({
        equitiesApiKey: key,
        equitiesBaseUrl: process.env.MARKET_DATA_API_URL,
        qseApiKey: process.env.QSE_API_KEY,
        qcbApiKey: process.env.QCB_API_KEY,
      });
      return instance;
    }
    // eslint-disable-next-line no-console
    console.warn(
      "[market] MARKET_DATA_PROVIDER=real but MARKET_DATA_API_KEY is unset — falling back to mock data.",
    );
  }

  instance = new MockMarketDataService();
  return instance;
}

export type { MarketDataService } from "./MarketDataService";
