import { type NextRequest, NextResponse } from "next/server";
import { apiUrl } from "@/lib/env";
import { sessionToken } from "@/lib/cookie";

/**
 * Browser-facing proxy to `/v1/admin/*` for the console's interactive parts. It attaches the
 * staff member's token from the httpOnly cookie, so the token never reaches page scripts. Sign-in
 * routes are not reachable through it, and writes must come from the console's own origin.
 */
async function forward(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  const { path } = await ctx.params;
  if (!path.length || path[0] === "users" || path[0] === "sessions")
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (req.method !== "GET") {
    const origin = req.headers.get("origin");
    if (!origin || new URL(origin).host !== req.headers.get("host"))
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const token = await sessionToken();
  if (!token) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const target = `${apiUrl()}/v1/admin/${path.map(encodeURIComponent).join("/")}${req.nextUrl.search}`;
  const body = req.method === "GET" ? undefined : await req.text();
  const res = await fetch(target, {
    method: req.method,
    cache: "no-store",
    headers: {
      authorization: `Bearer ${token}`,
      ...(body ? { "content-type": "application/json" } : {}),
    },
    ...(body ? { body } : {}),
  });
  const headers = new Headers({ "cache-control": "no-store" });
  for (const h of ["content-type", "content-disposition"]) {
    const v = res.headers.get(h);
    if (v) headers.set(h, v);
  }
  return new NextResponse(await res.arrayBuffer(), { status: res.status, headers });
}

export { forward as GET, forward as PATCH, forward as POST };
