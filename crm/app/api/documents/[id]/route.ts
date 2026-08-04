import { NextResponse } from "next/server";
import { auth, AuthError } from "@/lib/auth";
import { readDocument } from "@/lib/services/documents";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const url = new URL(req.url);
  const inline = url.searchParams.get("disposition") === "inline";
  const version = url.searchParams.get("version") ? Number(url.searchParams.get("version")) : undefined;

  try {
    const { doc, bytes } = await readDocument(session.user, id, {
      version,
      disposition: inline ? "VIEW" : "DOWNLOAD",
    });
    return new NextResponse(new Uint8Array(bytes), {
      headers: {
        "Content-Type": doc.mime,
        "Content-Length": String(bytes.length),
        "Content-Disposition": `${inline ? "inline" : "attachment"}; filename="${encodeURIComponent(doc.name)}"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (e) {
    if (e instanceof AuthError) {
      return NextResponse.json({ error: e.message }, { status: e.message === "Not found" ? 404 : 403 });
    }
    throw e;
  }
}
