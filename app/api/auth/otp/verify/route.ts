import { NextRequest, NextResponse } from "next/server";
import { verifyOtp } from "@/lib/auth";

/** POST /api/auth/otp/verify — exchange the code for a session token. */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    if (!body.phone || !body.code) {
      return NextResponse.json({ error: "phone and code are required" }, { status: 400 });
    }
    const session = verifyOtp(String(body.phone), String(body.code), body.role);
    return NextResponse.json({ session });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 401 });
  }
}
