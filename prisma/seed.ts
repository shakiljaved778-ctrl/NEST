/**
 * Seed a fully demoable world: 3 users with distinct taste graphs, live trips
 * with pending guardian events, and wallet balances backed by real postings.
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  // Clean slate (dev only)
  await prisma.auditLog.deleteMany();
  await prisma.guardianEvent.deleteMany();
  await prisma.booking.deleteMany();
  await prisma.segment.deleteMany();
  await prisma.tripOption.deleteMany();
  await prisma.trip.deleteMany();
  await prisma.ledgerPosting.deleteMany();
  await prisma.walletAccount.deleteMany();
  await prisma.freezeContract.deleteMany();
  await prisma.membership.deleteMany();
  await prisma.tasteGraph.deleteMany();
  await prisma.apiPartner.deleteMany();
  await prisma.user.deleteMany();

  // ── Users with distinct taste graphs ──
  const aria = await prisma.user.create({
    data: {
      email: "aria@voyara.dev",
      homeCurrency: "USD",
      autonomyTier: "ACT",
      actCapMinor: 40000,
      tasteGraph: {
        create: {
          prefs: {
            hotelStyle: ["boutique", "design"],
            neighborhoods: ["Sultanahmet", "Karaköy", "Covent Garden"],
            pace: "relaxed",
            seat: "window",
            airlines: ["Voyara Air"],
            dietary: ["vegetarian"],
            amenities: ["rooftop", "breakfast"],
            budgetBands: [{ category: "hotel", minMinor: 8000, maxMinor: 16000, currency: "USD" }],
          },
        },
      },
    },
  });

  const marcus = await prisma.user.create({
    data: {
      email: "marcus@voyara.dev",
      homeCurrency: "USD",
      autonomyTier: "ASK",
      tasteGraph: {
        create: {
          prefs: {
            hotelStyle: ["business", "luxury"],
            neighborhoods: ["DIFC", "Marina Bay", "Midtown"],
            pace: "packed",
            seat: "aisle",
            airlines: ["Atlas Skyways", "Meridian"],
            dietary: [],
            amenities: ["gym", "spa"],
            budgetBands: [{ category: "hotel", minMinor: 20000, maxMinor: 60000, currency: "USD" }],
          },
        },
      },
    },
  });

  const lena = await prisma.user.create({
    data: {
      email: "lena@voyara.dev",
      homeCurrency: "USD",
      autonomyTier: "WATCH",
      tasteGraph: {
        create: {
          prefs: {
            hotelStyle: ["budget", "boutique"],
            neighborhoods: ["Shibuya", "Asakusa", "Bugis"],
            pace: "balanced",
            seat: "any",
            airlines: [],
            dietary: ["halal"],
            amenities: ["family-room"],
            budgetBands: [{ category: "hotel", minMinor: 6000, maxMinor: 14000, currency: "USD" }],
          },
        },
      },
    },
  });

  // ── Wallets + real double-entry postings ──
  for (const [user, credit] of [
    [aria, 4200],
    [marcus, 0],
    [lena, 1500],
  ] as const) {
    await prisma.walletAccount.create({
      data: { userId: user.id, currency: "USD", balanceMinor: credit },
    });
    if (credit > 0) {
      const txId = `seed_${user.id}`;
      await prisma.ledgerPosting.createMany({
        data: [
          { txId, accountId: "revenue:savings_fee", amountMinor: -credit, direction: "DEBIT", currency: "USD", memo: "seed savings rebate" },
          { txId, accountId: `wallet:${user.id}`, amountMinor: credit, direction: "CREDIT", currency: "USD", memo: "seed savings rebate" },
        ],
      });
    }
  }

  // ── Aria: a LIVE trip with a pending guardian event ──
  const trip = await prisma.trip.create({
    data: {
      userId: aria.id,
      status: "LIVE",
      intentText: "3 nights in Istanbul next weekend, boutique, under $150/night, near Sultanahmet",
      origin: "London",
      destinations: ["Istanbul"],
      dateRange: { checkIn: "2026-08-07", checkOut: "2026-08-10" },
      partySize: 2,
      budgetCapMinor: 45000,
      options: {
        create: [
          {
            rank: 1,
            fitScore: 0.82,
            totalPriceMinor: 29700,
            verdict: "BUY",
            verdictConfidence: 0.68,
            forecastCurve: [{ date: "2026-08-01", expectedPriceMinor: 9900 }],
            expiresAt: new Date(Date.now() + 30 * 60000),
            segments: {
              create: [
                { kind: "HOTEL", supplierRef: "mock-lodging:ist-02", status: "CONFIRMED", offerPayload: { title: "Blue Mosque House", neighborhood: "Sultanahmet" } },
              ],
            },
          },
        ],
      },
    },
  });

  await prisma.booking.create({
    data: {
      tripId: trip.id,
      sagaId: `bk_${trip.id}`,
      status: "CONFIRMED",
      pnrRefs: { HOTEL: "PNR-ist-02-4028" },
      totalChargedMinor: 27200,
      walletAppliedMinor: 2500,
    },
  });

  await prisma.guardianEvent.create({
    data: {
      tripId: trip.id,
      kind: "PRICE_DROP",
      payload: { was: 9900, now: 8600, offer: "Blue Mosque House" },
      remediation: "PROPOSED",
      savingsMinor: 1300,
    },
  });
  await prisma.guardianEvent.create({
    data: {
      tripId: trip.id,
      kind: "SCHEDULE_CHANGE",
      payload: { message: "Inbound flight retimed 21:40 → 22:15", heldAlt: "22:15" },
      remediation: "PROPOSED",
    },
  });

  // ── Voyara+ membership for Marcus ──
  await prisma.membership.create({
    data: {
      userId: marcus.id,
      plan: "VOYARA_PLUS",
      renewsAt: new Date(Date.now() + 365 * 86400000),
      perks: { wholesaleRates: true, freeFreezes: true, priorityGuardian: true, familyProfiles: true },
    },
  });

  // ── An MCP partner for the rails ──
  await prisma.apiPartner.create({
    data: {
      name: "Atlas Assistant",
      scopes: ["search_trips", "hold_offer", "book_trip", "get_trip_status"],
      perBookingFeeMinor: 500,
      rateLimit: 120,
    },
  });

  console.log("Seeded 3 users, 1 live trip w/ 2 pending guardian events, wallets, membership, MCP partner.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
