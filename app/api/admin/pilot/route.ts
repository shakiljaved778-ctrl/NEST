import { NextResponse } from "next/server";
import { pilotScoreboard } from "@/lib/pilot";

/** GET /api/admin/pilot — 90-day Doha pilot scoreboard (Seed-readiness gates). */
export function GET() {
  return NextResponse.json(pilotScoreboard());
}
