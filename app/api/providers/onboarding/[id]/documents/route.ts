import { NextRequest, NextResponse } from "next/server";
import { uploadDocument } from "@/lib/onboarding";

/** POST /api/providers/onboarding/:id/documents — register a KYC document upload. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await req.json();
    if (!body.type) return NextResponse.json({ error: "type is required (qid|passport|work_permit|certificate)" }, { status: 400 });
    const application = uploadDocument(id, body.type);
    return NextResponse.json({ application }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
}
