import { NextResponse } from "next/server";
import { verificationQueue } from "@/lib/onboarding";

/** GET /api/admin/verification — the ops KYC review queue. */
export function GET() {
  return NextResponse.json({ queue: verificationQueue() });
}
