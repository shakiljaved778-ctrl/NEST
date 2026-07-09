import { NextResponse } from "next/server";
import { SERVICES, ZONES } from "@/lib/catalog";

export function GET() {
  return NextResponse.json({ services: SERVICES, zones: ZONES });
}
