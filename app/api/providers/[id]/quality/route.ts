import { NextRequest, NextResponse } from "next/server";
import { PROVIDERS } from "@/lib/providers";
import { computeQualityScore, signalsForProvider } from "@/lib/quality";
import { listBookings } from "@/lib/store";

/** GET /api/providers/:id/quality — AI quality score for a provider. */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const provider = PROVIDERS.find((p) => p.id === id);
  if (!provider) return NextResponse.json({ error: "Provider not found" }, { status: 404 });
  const signals = signalsForProvider(provider, listBookings());
  return NextResponse.json({ providerId: id, signals, quality: computeQualityScore(signals) });
}
