import { notFound } from "next/navigation";
import { db } from "@/lib/db";

export const metadata = { title: "Contact us" };
export const dynamic = "force-dynamic";

// Public, embeddable lead-capture form (iframe-able). Posts to the tokenized
// capture endpoint. No app chrome, no session required.
export default async function CaptureFormPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ submitted?: string }>;
}) {
  const { token } = await params;
  const { submitted } = await searchParams;
  const captureToken = await db.captureToken.findFirst({ where: { token, kind: "FORM", active: true } });
  if (!captureToken) notFound();

  if (submitted) {
    return (
      <div className="mx-auto max-w-md p-8 text-center">
        <h1 className="text-xl font-semibold">Thank you!</h1>
        <p className="mt-2 text-sm text-muted-foreground">Our team will contact you shortly.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md p-6">
      <h1 className="text-xl font-semibold">Get in touch</h1>
      <p className="mb-4 mt-1 text-sm text-muted-foreground">Tell us a bit about you and we&apos;ll call you back.</p>
      <form method="POST" action={`/capture/form/${token}/submit`} className="space-y-3">
        <input type="hidden" name="token" value={token} />
        {/* honeypot */}
        <input type="text" name="website_url" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden="true" />
        <div className="grid grid-cols-2 gap-3">
          <input name="firstName" required placeholder="First name *" className="h-9 rounded-md border px-3 text-sm" />
          <input name="lastName" required placeholder="Last name *" className="h-9 rounded-md border px-3 text-sm" />
        </div>
        <input name="company" placeholder="Company" className="h-9 w-full rounded-md border px-3 text-sm" />
        <input name="email" type="email" placeholder="Email" className="h-9 w-full rounded-md border px-3 text-sm" />
        <input name="phone" placeholder="Phone (+974 …)" className="h-9 w-full rounded-md border px-3 text-sm" />
        <textarea name="message" placeholder="How can we help?" rows={3} className="w-full rounded-md border px-3 py-2 text-sm" />
        <label className="flex items-start gap-2 text-xs text-muted-foreground">
          <input type="checkbox" name="consent" value="true" required className="mt-0.5" />
          I consent to the processing of my personal data for the purpose of being contacted about products and
          services, per Qatar Law No. 13 of 2016.
        </label>
        <button type="submit" className="h-9 w-full rounded-md bg-emerald-800 text-sm font-medium text-white hover:bg-emerald-700">
          Request a callback
        </button>
      </form>
    </div>
  );
}
