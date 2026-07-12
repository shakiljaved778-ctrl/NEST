import { NextRequest, NextResponse } from "next/server";
import { completeTraining, reviewApplication } from "@/lib/onboarding";

/**
 * PATCH /api/admin/verification/:id
 * { action: "approve" | "reject", note? }        — ops document review
 * { action: "training_result", score: 0–1 }      — assessment outcome (pass ⇒ LIVE)
 */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await req.json();
    if (body.action === "approve" || body.action === "reject") {
      return NextResponse.json({ application: reviewApplication(id, body.action, body.note) });
    }
    if (body.action === "training_result") {
      return NextResponse.json({ application: completeTraining(id, Number(body.score)) });
    }
    return NextResponse.json({ error: "action must be approve, reject or training_result" }, { status: 400 });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
}
