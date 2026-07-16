import { NextResponse } from "next/server";
import { auth, AuthError } from "@/lib/auth";
import { exportClientData } from "@/lib/services/clients";

// PDPPL subject-access data export (JSON). Admin only.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  try {
    const data = await exportClientData(session.user, "account", id);
    return new NextResponse(JSON.stringify(data, null, 2), {
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="account-${id}-export.json"`,
      },
    });
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: 403 });
    throw e;
  }
}
