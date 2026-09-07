"use client";
/**
 * Hook: values a portfolio using plan-aware live quotes. Returns the computed
 * valuation plus loading state. Shared by the home summary and the full tracker.
 */
import { useMemo } from "react";
import type { PlanTier, Portfolio, PortfolioValuation } from "@/types/market";
import { marketApi } from "@/lib/market/api";
import { useAsync } from "@/lib/market/useAsync";
import { valuePortfolio } from "@/lib/market/portfolioMath";

export function usePortfolioValuation(
  portfolio: Portfolio | null,
  plan: PlanTier,
): { valuation: PortfolioValuation | null; loading: boolean } {
  const symbols = portfolio?.holdings.map((h) => h.symbol) ?? [];
  const key = symbols.join(",");
  const { data, loading } = useAsync(
    () => (symbols.length ? marketApi.quotes(symbols, plan) : Promise.resolve({ quotes: {}, isMock: true })),
    [key, plan],
    { refetchInterval: plan === "premium" ? 5000 : 30000, enabled: !!portfolio },
  );

  const valuation = useMemo(() => {
    if (!portfolio) return null;
    return valuePortfolio(portfolio, data?.quotes ?? {});
  }, [portfolio, data]);

  return { valuation, loading };
}
