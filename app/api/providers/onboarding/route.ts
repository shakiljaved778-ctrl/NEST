import { NextRequest, NextResponse } from "next/server";
import { listApplications, submitApplication } from "@/lib/onboarding";

/** GET /api/providers/onboarding — all applications. POST — submit a new one. */
export function GET() {
  return NextResponse.json({ applications: listApplications() });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    for (const field of ["name", "phone", "gender", "skills", "zones", "languages"]) {
      if (!body[field]) return NextResponse.json({ error: `${field} is required` }, { status: 400 });
    }
    const application = submitApplication({
      name: String(body.name),
      phone: String(body.phone),
      gender: body.gender,
      skills: body.skills,
      zones: body.zones,
      languages: body.languages,
      yearsExperience: Number(body.yearsExperience ?? 0),
    });
    return NextResponse.json({ application }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
}
