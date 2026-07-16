import { NextResponse } from "next/server";

// Bridge: the embeddable form posts here (same-origin), we forward to the
// capture API and redirect back with a thank-you state.
export async function POST(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const form = await req.formData();
  form.set("token", token);

  const captureUrl = new URL("/api/capture/leads", req.url);
  const res = await fetch(captureUrl, { method: "POST", body: form, headers: { "x-forwarded-for": req.headers.get("x-forwarded-for") ?? "" } });

  const back = new URL(`/capture/form/${token}`, req.url);
  if (res.ok) back.searchParams.set("submitted", "1");
  else back.searchParams.set("error", "1");
  return NextResponse.redirect(back, 303);
}
