import { NextResponse } from "next/server";
import { runPendingJobs, ensureSystemJobs } from "@/lib/jobs";

// External cron entry point (alternative to the in-process worker for
// serverless deploys). Protected by JOBS_RUN_TOKEN.
export async function POST(req: Request) {
  const token = process.env.JOBS_RUN_TOKEN;
  if (!token) return NextResponse.json({ error: "Disabled — set JOBS_RUN_TOKEN" }, { status: 404 });
  const provided = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (provided !== token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await ensureSystemJobs();
  const processed = await runPendingJobs();
  return NextResponse.json({ ok: true, processed });
}
