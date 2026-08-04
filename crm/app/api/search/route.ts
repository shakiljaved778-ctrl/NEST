import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { globalSearch } from "@/lib/services/search";

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const q = new URL(req.url).searchParams.get("q")?.trim() ?? "";
  if (!q) return NextResponse.json({ results: [] });

  const results = await globalSearch(session.user, q);
  return NextResponse.json({ results });
}
