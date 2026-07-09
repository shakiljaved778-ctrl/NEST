import { NextRequest, NextResponse } from "next/server";
import { buildQuote } from "@/lib/pricing";
import { matchProviders } from "@/lib/providers";
import { createBooking, listBookings } from "@/lib/store";

export function GET() {
  return NextResponse.json({ bookings: listBookings() });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const required = ["serviceId", "packageId", "zoneId", "date", "slot", "customerName"];
    for (const field of required) {
      if (!body[field]) {
        return NextResponse.json({ error: `${field} is required` }, { status: 400 });
      }
    }

    const quote = buildQuote({
      serviceId: body.serviceId,
      packageId: body.packageId,
      addonIds: body.addonIds,
      slot: body.slot,
      urgent: body.urgent,
      couponCode: body.couponCode,
      nestPlus: body.nestPlus,
    });

    const matches = matchProviders({
      serviceId: body.serviceId,
      zoneId: body.zoneId,
      language: body.language,
      genderPreference: body.genderPreference,
      urgent: body.urgent,
    });

    const booking = createBooking({
      serviceId: body.serviceId,
      packageId: body.packageId,
      addonIds: body.addonIds ?? [],
      zoneId: body.zoneId,
      address: body.address ?? "",
      date: body.date,
      slot: body.slot,
      urgent: Boolean(body.urgent),
      couponCode: body.couponCode,
      paymentMethod: body.paymentMethod ?? "card",
      quote,
      providerId: matches[0]?.provider.id,
      customerName: body.customerName,
      language: body.language ?? "en",
    });

    return NextResponse.json({ booking, match: matches[0] ?? null }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
}
