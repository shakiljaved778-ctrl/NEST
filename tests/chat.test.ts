import { beforeEach, describe, expect, it } from "vitest";
import { sendMessage, threadFor } from "../lib/chat";
import { createBooking } from "../lib/store";
import { buildQuote } from "../lib/pricing";
import type { LanguageCode } from "../lib/types";

beforeEach(() => {
  globalThis.__nestBookings = undefined;
  globalThis.__nestChat = undefined;
});

function makeBooking(language: LanguageCode = "ar") {
  return createBooking({
    serviceId: "house-cleaning",
    packageId: "hc-2h",
    addonIds: [],
    zoneId: "the-pearl",
    address: "Tower 3",
    date: "2026-07-10",
    slot: "10:00",
    urgent: false,
    paymentMethod: "card",
    quote: buildQuote({ serviceId: "house-cleaning", packageId: "hc-2h" }),
    providerId: "p2",
    customerName: "Chat Tester",
    language,
  });
}

describe("auto-translated chat", () => {
  it("translates provider messages into the customer's booking language", () => {
    const b = makeBooking("ar");
    const msg = sendMessage({ bookingId: b.id, sender: "provider", text: "I am on my way" });
    expect(msg.original).toBe("I am on my way");
    expect(msg.translated).toBe("أنا في الطريق");
    expect(msg.translatedLang).toBe("ar");
    expect(msg.originalLang).toBe("en");
  });

  it("stores original AND translation (production contract)", () => {
    const b = makeBooking("tl");
    sendMessage({ bookingId: b.id, sender: "provider", text: "I have arrived" });
    const [msg] = threadFor(b.id);
    expect(msg.original).toBe("I have arrived");
    expect(msg.translated).toBe("Nandito na ako");
  });

  it("flags emergencies mid-conversation", () => {
    const b = makeBooking("en");
    const msg = sendMessage({ bookingId: b.id, sender: "customer", text: "There is smoke coming from the AC" });
    expect(msg.flagEmergency).toBe(true);
  });

  it("threads messages per booking in order", () => {
    const b1 = makeBooking("ar");
    const b2 = makeBooking("hi");
    sendMessage({ bookingId: b1.id, sender: "customer", text: "Where can I park?", recipientLang: "en" });
    sendMessage({ bookingId: b1.id, sender: "provider", text: "I have arrived" });
    sendMessage({ bookingId: b2.id, sender: "provider", text: "Thank you" });
    expect(threadFor(b1.id)).toHaveLength(2);
    expect(threadFor(b2.id)).toHaveLength(1);
    expect(threadFor(b2.id)[0].translated).toBe("धन्यवाद");
  });

  it("rejects unknown bookings and empty messages", () => {
    expect(() => sendMessage({ bookingId: "NB-nope", sender: "customer", text: "hi" })).toThrow(/Unknown booking/);
    const b = makeBooking();
    expect(() => sendMessage({ bookingId: b.id, sender: "customer", text: "   " })).toThrow(/empty/);
  });
});
