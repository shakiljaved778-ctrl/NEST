import { notFound } from "next/navigation";
import { SymbolDetail } from "@/components/market/panels/SymbolDetail";
import { isValidSymbol } from "@/lib/market/instruments";

export default async function SymbolPage({
  params,
}: {
  params: Promise<{ symbol: string }>;
}) {
  const { symbol } = await params;
  if (!isValidSymbol(symbol)) notFound();
  return <SymbolDetail symbol={symbol.toUpperCase()} />;
}
