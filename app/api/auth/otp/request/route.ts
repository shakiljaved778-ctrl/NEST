import { NextRequest, NextResponse } from "next/server";
import { requestOtp } from "@/lib/auth";

/** POST /api/auth/otp/request — issue a login code (SMS in production; demo code returned here). */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    if (!body.phone) return NextResponse.json({ error: "phone is required" }, { status: 400 });
    return NextResponse.json(requestOtp(String(body.phone)));
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
}
