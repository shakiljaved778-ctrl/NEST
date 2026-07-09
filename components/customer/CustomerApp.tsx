"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import PhoneFrame from "@/components/PhoneFrame";
import { SERVICES, ZONES, getService, getZone } from "@/lib/catalog";
import { LANGUAGES, isRtl, t as translate } from "@/lib/i18n";
import { COUPONS, buildQuote } from "@/lib/pricing";
import type { Booking, LanguageCode, MatchResult, Quote, Service } from "@/lib/types";

/* ------------------------------------------------------------------ */
/* Screen model                                                        */
/* ------------------------------------------------------------------ */

type Screen =
  | "splash"
  | "language"
  | "otp-phone"
  | "otp-code"
  | "zone"
  | "home"
  | "service"
  | "addons"
  | "schedule"
  | "address"
  | "payment"
  | "matching"
  | "confirmed"
  | "tracking"
  | "chat"
  | "rating"
  | "bookings"
  | "assistant"
  | "account"
  | "wallet"
  | "subscriptions"
  | "help"
  | "profile";

const SCREEN_MAP: { group: string; screens: { id: Screen; label: string }[] }[] = [
  {
    group: "Onboarding",
    screens: [
      { id: "splash", label: "Splash" },
      { id: "language", label: "Language" },
      { id: "otp-phone", label: "Phone login" },
      { id: "otp-code", label: "OTP verify" },
      { id: "zone", label: "Location" },
    ],
  },
  {
    group: "Booking flow",
    screens: [
      { id: "home", label: "Home" },
      { id: "service", label: "Service & packages" },
      { id: "addons", label: "Add-ons" },
      { id: "schedule", label: "Date & time" },
      { id: "address", label: "Address" },
      { id: "payment", label: "Payment" },
      { id: "matching", label: "AI matching" },
      { id: "confirmed", label: "Confirmation" },
      { id: "tracking", label: "Live tracking" },
      { id: "chat", label: "In-app chat" },
      { id: "rating", label: "Rating & review" },
    ],
  },
  {
    group: "More",
    screens: [
      { id: "bookings", label: "Booking history" },
      { id: "assistant", label: "AI assistant" },
      { id: "wallet", label: "Wallet & coupons" },
      { id: "subscriptions", label: "Nest+ plans" },
      { id: "help", label: "Complaint / refund" },
      { id: "profile", label: "Profile & family" },
    ],
  },
];

const SLOTS = ["08:00", "09:30", "11:00", "13:00", "14:30", "16:00", "17:30", "19:00", "20:30"];

interface ChatMsg {
  from: "me" | "them";
  text: string;
  translated?: string;
}

/* ------------------------------------------------------------------ */
/* Component                                                           */
/* ------------------------------------------------------------------ */

export default function CustomerApp({
  initialScreen,
  initialServiceId,
}: {
  initialScreen?: string;
  initialServiceId?: string;
}) {
  const initService = initialServiceId ? getService(initialServiceId) : undefined;

  const [screen, setScreen] = useState<Screen>(
    initService ? "service" : (initialScreen as Screen) || "splash",
  );
  const [lang, setLang] = useState<LanguageCode>("en");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [zoneId, setZoneId] = useState<string>("west-bay");
  const [service, setService] = useState<Service | undefined>(initService);
  const [packageId, setPackageId] = useState<string | undefined>(initService?.packages[0]?.id);
  const [addonIds, setAddonIds] = useState<string[]>([]);
  const [date, setDate] = useState<"today" | "tomorrow">("today");
  const [slot, setSlot] = useState<string>("16:00");
  const [urgent, setUrgent] = useState(false);
  const [address, setAddress] = useState("Marina Tower 12, Apt 804");
  const [coupon, setCoupon] = useState("");
  const [couponMsg, setCouponMsg] = useState<string | null>(null);
  const [payMethod, setPayMethod] = useState("card");
  const [booking, setBooking] = useState<Booking | null>(null);
  const [match, setMatch] = useState<MatchResult | null>(null);
  const [search, setSearch] = useState("");
  const [stars, setStars] = useState(0);
  const [ratingDone, setRatingDone] = useState(false);
  const [trackStep, setTrackStep] = useState(1);
  const [chatMsgs, setChatMsgs] = useState<ChatMsg[]>([
    { from: "them", text: "Assalamu alaikum! I am on my way, arriving in about 15 minutes.", translated: "السلام عليكم! أنا في الطريق، سأصل خلال ١٥ دقيقة تقريباً." },
  ]);
  const [chatInput, setChatInput] = useState("");
  const [aiMsgs, setAiMsgs] = useState<{ from: "me" | "ai"; text: string; serviceId?: string }[]>([]);
  const [aiInput, setAiInput] = useState("");
  const [aiBusy, setAiBusy] = useState(false);
  const [complaint, setComplaint] = useState("");
  const [complaintResult, setComplaintResult] = useState<null | {
    category: string;
    priority: string;
    humanEscalation: boolean;
  }>(null);
  const [error, setError] = useState<string | null>(null);

  const dir = isRtl(lang) ? "rtl" : "ltr";
  const t = (key: string) => translate(lang, key);
  const zone = getZone(zoneId);

  /* auto-advance splash */
  useEffect(() => {
    if (screen !== "splash") return;
    const id = setTimeout(() => setScreen("language"), 1600);
    return () => clearTimeout(id);
  }, [screen]);

  /* live-tracking progress simulation */
  useEffect(() => {
    if (screen !== "tracking" || trackStep >= 4) return;
    const id = setTimeout(() => setTrackStep((s) => Math.min(4, s + 1)), 3500);
    return () => clearTimeout(id);
  }, [screen, trackStep]);

  const quote: Quote | null = useMemo(() => {
    if (!service || !packageId) return null;
    try {
      return buildQuote({
        serviceId: service.id,
        packageId,
        addonIds,
        slot,
        urgent,
        couponCode: coupon || undefined,
      });
    } catch {
      return null;
    }
  }, [service, packageId, addonIds, slot, urgent, coupon]);

  function openService(s: Service) {
    setService(s);
    setPackageId(s.packages.find((p) => p.popular)?.id ?? s.packages[0]?.id);
    setAddonIds([]);
    setScreen("service");
  }

  function applyCoupon() {
    const c = COUPONS[coupon.trim().toUpperCase()];
    setCouponMsg(c ? `✓ ${c.label}` : "Invalid code");
  }

  async function confirmAndPay() {
    if (!service || !packageId) return;
    setError(null);
    setScreen("matching");
    const dt = new Date();
    if (date === "tomorrow") dt.setDate(dt.getDate() + 1);
    try {
      const res = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          serviceId: service.id,
          packageId,
          addonIds,
          zoneId,
          address,
          date: dt.toISOString().slice(0, 10),
          slot,
          urgent,
          couponCode: coupon || undefined,
          paymentMethod: payMethod,
          customerName: "Demo Customer",
          language: lang,
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Booking failed");
      const data = await res.json();
      // brief pause so the matching animation reads
      setTimeout(() => {
        setBooking(data.booking);
        setMatch(data.match);
        setScreen("confirmed");
      }, 2200);
    } catch (err) {
      setError((err as Error).message);
      setScreen("payment");
    }
  }

  async function sendAi() {
    const msg = aiInput.trim();
    if (!msg || aiBusy) return;
    setAiMsgs((m) => [...m, { from: "me", text: msg }]);
    setAiInput("");
    setAiBusy(true);
    try {
      const res = await fetch("/api/ai/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: msg, language: lang }),
      });
      const data = await res.json();
      setAiMsgs((m) => [...m, { from: "ai", text: data.reply, serviceId: data.suggestedServiceId }]);
    } catch {
      setAiMsgs((m) => [...m, { from: "ai", text: "Sorry — I couldn't reach Nest AI. Please try again." }]);
    } finally {
      setAiBusy(false);
    }
  }

  async function submitComplaint() {
    if (!complaint.trim()) return;
    try {
      const res = await fetch("/api/ai/complaint", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: complaint }),
      });
      setComplaintResult(await res.json());
    } catch {
      setComplaintResult({ category: "other", priority: "medium", humanEscalation: true });
    }
  }

  function sendChat() {
    const msg = chatInput.trim();
    if (!msg) return;
    setChatMsgs((m) => [...m, { from: "me", text: msg }]);
    setChatInput("");
    setTimeout(
      () =>
        setChatMsgs((m) => [
          ...m,
          { from: "them", text: "Noted, thank you! See you shortly. 👍", translated: "تمام، شكراً لك! أراك قريباً." },
        ]),
      1200,
    );
  }

  /* ---------------------------------------------------------------- */
  /* Shared pieces                                                     */
  /* ---------------------------------------------------------------- */

  const accentBg = (a: Service["accent"]) =>
    a === "teal" ? "bg-teal text-white" : a === "gold" ? "bg-gold text-navy-800" : "bg-navy text-white";

  function Header({ title, back }: { title: string; back?: Screen }) {
    return (
      <div className="flex items-center gap-3 px-5 py-3 bg-white border-b border-navy-100">
        {back && (
          <button
            onClick={() => setScreen(back)}
            aria-label={t("back")}
            className="h-8 w-8 rounded-full bg-pearl text-navy flex items-center justify-center font-bold"
          >
            {dir === "rtl" ? "→" : "←"}
          </button>
        )}
        <h2 className="font-display font-bold text-navy text-lg">{title}</h2>
      </div>
    );
  }

  function BottomNav() {
    const items: { id: Screen; icon: string; label: string }[] = [
      { id: "home", icon: "⌂", label: t("home") },
      { id: "bookings", icon: "📋", label: t("bookings") },
      { id: "assistant", icon: "✦", label: t("assistant") },
      { id: "account", icon: "👤", label: t("account") },
    ];
    return (
      <nav className="grid grid-cols-4 border-t border-navy-100 bg-white">
        {items.map((it) => {
          const active =
            screen === it.id || (it.id === "account" && ["wallet", "subscriptions", "help", "profile"].includes(screen));
          return (
            <button
              key={it.id}
              onClick={() => setScreen(it.id)}
              className={`py-2.5 text-center text-[11px] font-semibold ${active ? "text-teal" : "text-navy-300"}`}
            >
              <span className="block text-lg leading-none">{it.icon}</span>
              {it.label}
            </button>
          );
        })}
      </nav>
    );
  }

  function PriceSummary() {
    if (!quote) return null;
    return (
      <div className="card p-4 space-y-1.5 text-sm">
        {quote.lines.map((l) => (
          <div key={l.label} className="flex justify-between text-navy-600">
            <span>{l.label}</span>
            <span>QAR {l.amount}</span>
          </div>
        ))}
        {quote.surcharge > 0 && (
          <div className="flex justify-between text-gold-dark">
            <span>{quote.peak ? "Peak-hour uplift" : ""}{quote.peak && urgent ? " + " : ""}{urgent ? "Urgency" : ""}</span>
            <span>+QAR {quote.surcharge}</span>
          </div>
        )}
        {quote.discount > 0 && (
          <div className="flex justify-between text-teal">
            <span>Discount</span>
            <span>−QAR {quote.discount}</span>
          </div>
        )}
        <div className="flex justify-between border-t border-navy-100 pt-2 font-bold text-navy">
          <span>{t("total")}</span>
          <span>QAR {quote.total}</span>
        </div>
      </div>
    );
  }

  /* ---------------------------------------------------------------- */
  /* Screens                                                           */
  /* ---------------------------------------------------------------- */

  function renderScreen() {
    switch (screen) {
      case "splash":
        return (
          <div className="flex-1 bg-navy-800 text-white flex flex-col items-center justify-center gap-4">
            <span className="flex h-20 w-20 items-center justify-center rounded-full bg-gold text-navy-800 text-4xl">⌂</span>
            <p className="font-display text-2xl font-bold tracking-wide">NEST</p>
            <p className="text-navy-200 text-sm">{t("tagline")}</p>
            <span className="mt-6 h-1.5 w-24 overflow-hidden rounded bg-white/15">
              <span className="block h-full w-1/2 bg-gold animate-pulse" />
            </span>
          </div>
        );

      case "language":
        return (
          <div className="flex-1 flex flex-col px-6 pt-10 pb-6">
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-navy text-gold text-xl mb-6">⌂</span>
            <h2 className="font-display text-2xl font-bold text-navy">{t("chooseLanguage")}</h2>
            <p className="text-sm text-navy-400 mt-1 mb-6">اختر لغتك · अपनी भाषा चुनें</p>
            <div className="grid grid-cols-2 gap-3">
              {LANGUAGES.map((l) => (
                <button
                  key={l.code}
                  onClick={() => setLang(l.code)}
                  className={`card p-4 text-start ${lang === l.code ? "!border-teal ring-2 ring-teal/30" : ""}`}
                >
                  <span className="block font-bold text-navy">{l.native}</span>
                  <span className="block text-xs text-navy-400">{l.label}{l.rtl ? " · RTL" : ""}</span>
                </button>
              ))}
            </div>
            <button onClick={() => setScreen("otp-phone")} className="btn-primary mt-auto">
              {t("continue")}
            </button>
          </div>
        );

      case "otp-phone":
        return (
          <div className="flex-1 flex flex-col px-6 pt-10 pb-6">
            <h2 className="font-display text-2xl font-bold text-navy">{t("welcome")}</h2>
            <p className="text-sm text-navy-400 mt-1 mb-8">{t("phoneLogin")}</p>
            <label className="card flex items-center gap-3 px-4 py-3">
              <span className="font-bold text-navy">🇶🇦 +974</span>
              <input
                dir="ltr"
                value={phone}
                onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 8))}
                placeholder={t("phonePlaceholder")}
                className="flex-1 bg-transparent outline-none text-navy font-semibold"
                inputMode="numeric"
              />
            </label>
            <p className="text-xs text-navy-400 mt-3">
              OTP login · JWT sessions · your number is never shared with providers.
            </p>
            <button
              disabled={phone.length < 8}
              onClick={() => setScreen("otp-code")}
              className="btn-primary mt-auto"
            >
              {t("sendOtp")}
            </button>
          </div>
        );

      case "otp-code":
        return (
          <div className="flex-1 flex flex-col px-6 pt-10 pb-6">
            <h2 className="font-display text-2xl font-bold text-navy">{t("enterOtp")}</h2>
            <p className="text-sm text-navy-400 mt-1 mb-8" dir="ltr">
              {t("otpHint")} +974 {phone || "5555 1234"}
            </p>
            <div className="flex gap-3 justify-center" dir="ltr">
              {[0, 1, 2, 3].map((i) => (
                <span
                  key={i}
                  className={`h-14 w-12 card flex items-center justify-center text-xl font-bold text-navy ${
                    otp.length === i ? "!border-teal ring-2 ring-teal/30" : ""
                  }`}
                >
                  {otp[i] ?? ""}
                </span>
              ))}
            </div>
            <input
              autoFocus
              dir="ltr"
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 4))}
              className="opacity-0 h-0"
              inputMode="numeric"
            />
            <div className="grid grid-cols-3 gap-2 mt-8" dir="ltr">
              {["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "⌫"].map((k, i) => (
                <button
                  key={i}
                  disabled={k === ""}
                  onClick={() =>
                    k === "⌫" ? setOtp((o) => o.slice(0, -1)) : setOtp((o) => (o + k).slice(0, 4))
                  }
                  className="h-12 rounded-xl bg-white border border-navy-100 font-bold text-navy disabled:opacity-0"
                >
                  {k}
                </button>
              ))}
            </div>
            <button disabled={otp.length < 4} onClick={() => setScreen("zone")} className="btn-primary mt-auto">
              {t("verify")}
            </button>
          </div>
        );

      case "zone":
        return (
          <div className="flex-1 flex flex-col px-6 pt-10 pb-6 overflow-hidden">
            <h2 className="font-display text-2xl font-bold text-navy">{t("selectZone")}</h2>
            <p className="text-sm text-navy-400 mt-1 mb-5">{t("zoneHint")}</p>
            <div className="flex-1 overflow-y-auto phone-scroll space-y-2 pr-1">
              {ZONES.map((z) => (
                <button
                  key={z.id}
                  onClick={() => setZoneId(z.id)}
                  className={`card w-full p-4 flex items-center justify-between ${
                    zoneId === z.id ? "!border-teal ring-2 ring-teal/30" : ""
                  }`}
                >
                  <span className="text-start">
                    <span className="block font-bold text-navy">📍 {z.name}</span>
                    <span className="block text-xs text-navy-400">{z.nameAr}</span>
                  </span>
                  {z.wave === 1 && <span className="chip bg-gold-soft text-gold-dark">Launch zone</span>}
                </button>
              ))}
            </div>
            <button onClick={() => setScreen("home")} className="btn-primary mt-4">
              {t("continue")}
            </button>
          </div>
        );

      case "home": {
        const filtered = SERVICES.filter((s) =>
          `${s.name} ${s.nameAr}`.toLowerCase().includes(search.toLowerCase()),
        );
        return (
          <>
            <div className="flex-1 overflow-y-auto phone-scroll">
              <div className="bg-navy-800 text-white px-5 pt-4 pb-6 rounded-b-3xl">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-navy-200">
                      📍 {zone?.name} · {zone?.nameAr}
                    </p>
                    <h2 className="font-display text-xl font-bold mt-1">{t("goodMorning")}</h2>
                    <p className="text-sm text-navy-100">{t("whatDoYouNeed")}</p>
                  </div>
                  <button
                    onClick={() => setScreen("profile")}
                    className="h-10 w-10 rounded-full bg-gold text-navy-800 font-bold"
                  >
                    SJ
                  </button>
                </div>
                <label className="mt-4 flex items-center gap-2 rounded-xl bg-white px-4 py-3">
                  <span>🔍</span>
                  <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder={t("searchServices")}
                    className="flex-1 bg-transparent text-sm text-navy outline-none"
                  />
                </label>
              </div>

              <button
                onClick={() => setScreen("assistant")}
                className="mx-5 mt-4 card w-[calc(100%-2.5rem)] p-4 flex items-center gap-3 text-start"
              >
                <span className="h-10 w-10 rounded-full bg-teal text-white flex items-center justify-center text-lg">✦</span>
                <span className="flex-1 text-sm font-semibold text-navy">{t("aiBanner")}</span>
                <span className="text-teal font-bold">{dir === "rtl" ? "←" : "→"}</span>
              </button>

              <div className="px-5 mt-5">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-display font-bold text-navy">{t("allServices")}</h3>
                  <span className="chip bg-teal-soft text-teal-dark">✓ {t("verifiedPro")}</span>
                </div>
                <div className="grid grid-cols-3 gap-3 pb-5">
                  {filtered.map((s) => (
                    <button key={s.id} onClick={() => openService(s)} className="card p-3 text-center">
                      <span className={`mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-full text-lg ${accentBg(s.accent)}`}>
                        {s.icon}
                      </span>
                      <span className="block text-[11px] font-bold text-navy leading-tight">
                        {lang === "ar" ? s.nameAr : s.name}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <BottomNav />
          </>
        );
      }

      case "service": {
        if (!service) return null;
        return (
          <>
            <Header title={lang === "ar" ? service.nameAr : service.name} back="home" />
            <div className="flex-1 overflow-y-auto phone-scroll px-5 py-4 space-y-4">
              <div className="card p-4 flex items-center gap-3">
                <span className={`h-12 w-12 rounded-full flex items-center justify-center text-xl ${accentBg(service.accent)}`}>
                  {service.icon}
                </span>
                <div>
                  <p className="text-sm font-semibold text-navy">{service.tagline}</p>
                  <p className="text-xs text-navy-400 mt-0.5">✓ {t("verifiedPro")} · ★ 4.8 avg · rework guarantee</p>
                </div>
              </div>
              {service.safetyNote && (
                <p className="rounded-xl bg-gold-soft text-gold-dark text-xs font-semibold px-4 py-3">
                  ⚠ {service.safetyNote}
                </p>
              )}
              <div>
                <h3 className="font-display font-bold text-navy mb-2">{t("choosePackage")}</h3>
                <div className="space-y-2">
                  {service.packages.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => setPackageId(p.id)}
                      className={`card w-full p-4 text-start ${packageId === p.id ? "!border-teal ring-2 ring-teal/30" : ""}`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-navy text-sm">
                          {lang === "ar" ? p.nameAr : p.name}
                          {p.popular && <span className="chip bg-gold-soft text-gold-dark ms-2">★ {t("popular")}</span>}
                        </span>
                        <span className="font-bold text-navy">QAR {p.price}</span>
                      </div>
                      <p className="text-xs text-navy-400 mt-1">
                        {p.description}
                        {p.duration ? ` · ${Math.round(p.duration / 60)}h` : ""}
                      </p>
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="p-4 bg-white border-t border-navy-100">
              <button onClick={() => setScreen("addons")} className="btn-primary w-full" disabled={!packageId}>
                {t("continue")} {quote ? `· QAR ${quote.total}` : ""}
              </button>
            </div>
          </>
        );
      }

      case "addons": {
        if (!service) return null;
        return (
          <>
            <Header title={t("addons")} back="service" />
            <div className="flex-1 overflow-y-auto phone-scroll px-5 py-4 space-y-2">
              <p className="text-xs text-navy-400 mb-2">✦ Nest AI suggests these for {service.name.toLowerCase()}:</p>
              {service.addons.map((a) => {
                const on = addonIds.includes(a.id);
                return (
                  <button
                    key={a.id}
                    onClick={() => setAddonIds((ids) => (on ? ids.filter((x) => x !== a.id) : [...ids, a.id]))}
                    className={`card w-full p-4 flex items-center justify-between ${on ? "!border-teal ring-2 ring-teal/30" : ""}`}
                  >
                    <span className="text-start">
                      <span className="block text-sm font-bold text-navy">{lang === "ar" ? a.nameAr : a.name}</span>
                      <span className="block text-xs text-navy-400">{a.price === 0 ? "Free" : `QAR ${a.price}`}</span>
                    </span>
                    <span
                      className={`h-6 w-6 rounded-md border-2 flex items-center justify-center text-xs font-bold ${
                        on ? "bg-teal border-teal text-white" : "border-navy-200 text-transparent"
                      }`}
                    >
                      ✓
                    </span>
                  </button>
                );
              })}
            </div>
            <div className="p-4 bg-white border-t border-navy-100">
              <button onClick={() => setScreen("schedule")} className="btn-primary w-full">
                {t("continue")} {quote ? `· QAR ${quote.total}` : ""}
              </button>
            </div>
          </>
        );
      }

      case "schedule":
        return (
          <>
            <Header title={t("pickTime")} back="addons" />
            <div className="flex-1 overflow-y-auto phone-scroll px-5 py-4 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                {(["today", "tomorrow"] as const).map((d) => (
                  <button
                    key={d}
                    onClick={() => setDate(d)}
                    className={`card p-4 font-bold text-navy ${date === d ? "!border-teal ring-2 ring-teal/30" : ""}`}
                  >
                    {t(d)}
                  </button>
                ))}
              </div>
              <div className="grid grid-cols-3 gap-2">
                {SLOTS.map((s) => {
                  const peak = Number(s.split(":")[0]) >= 17 && Number(s.split(":")[0]) < 21;
                  return (
                    <button
                      key={s}
                      onClick={() => setSlot(s)}
                      className={`card p-3 text-sm font-semibold text-navy ${slot === s ? "!border-teal ring-2 ring-teal/30" : ""}`}
                    >
                      {s}
                      {peak && <span className="block text-[10px] text-gold-dark">peak +10%</span>}
                    </button>
                  );
                })}
              </div>
              <button
                onClick={() => setUrgent(!urgent)}
                className={`card w-full p-4 flex items-center justify-between ${urgent ? "!border-gold ring-2 ring-gold/30" : ""}`}
              >
                <span className="text-start">
                  <span className="block text-sm font-bold text-navy">⚡ {t("urgentLabel")}</span>
                  <span className="block text-xs text-navy-400">{t("urgentNote")} (+QAR 30)</span>
                </span>
                <span className={`h-6 w-11 rounded-full p-0.5 transition ${urgent ? "bg-gold" : "bg-navy-100"}`}>
                  <span className={`block h-5 w-5 rounded-full bg-white transition ${urgent ? "translate-x-5 rtl:-translate-x-5" : ""}`} />
                </span>
              </button>
              <PriceSummary />
            </div>
            <div className="p-4 bg-white border-t border-navy-100">
              <button onClick={() => setScreen("address")} className="btn-primary w-full">
                {t("continue")}
              </button>
            </div>
          </>
        );

      case "address":
        return (
          <>
            <Header title={t("address")} back="schedule" />
            <div className="flex-1 overflow-y-auto phone-scroll px-5 py-4 space-y-4">
              <div className="card h-36 relative overflow-hidden bg-teal-soft">
                {/* stylized map placeholder */}
                <div className="absolute inset-0 opacity-40" style={{ backgroundImage: "repeating-linear-gradient(0deg, transparent, transparent 22px, #0F9D8A22 23px), repeating-linear-gradient(90deg, transparent, transparent 22px, #0F9D8A22 23px)" }} />
                <span className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-4 w-4 rounded-full bg-teal pulse-dot" />
                <span className="absolute bottom-2 start-3 chip bg-white text-navy">📍 {zone?.name}</span>
              </div>
              <label className="card block px-4 py-3">
                <span className="text-xs font-semibold text-navy-400">{t("address")}</span>
                <input
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder={t("addressPlaceholder")}
                  className="w-full bg-transparent outline-none text-sm font-semibold text-navy mt-1"
                />
              </label>
              <div className="flex gap-2">
                {["Home", "Office", "Other"].map((tag, i) => (
                  <span key={tag} className={`chip ${i === 0 ? "bg-navy text-white" : "bg-white border border-navy-100 text-navy"}`}>
                    {tag}
                  </span>
                ))}
              </div>
              <p className="text-xs text-navy-400">
                Zone {zoneId === "west-bay" ? 61 : 66} · Blue-plate address supported · saved addresses sync to family profiles.
              </p>
            </div>
            <div className="p-4 bg-white border-t border-navy-100">
              <button onClick={() => setScreen("payment")} className="btn-primary w-full" disabled={!address.trim()}>
                {t("continue")}
              </button>
            </div>
          </>
        );

      case "payment":
        return (
          <>
            <Header title={t("payment")} back="address" />
            <div className="flex-1 overflow-y-auto phone-scroll px-5 py-4 space-y-4">
              {error && <p className="rounded-xl bg-red-50 text-red-700 text-xs font-semibold px-4 py-3">{error}</p>}
              <div className="space-y-2">
                {[
                  { id: "card", icon: "💳", label: t("card"), sub: "Visa •• 4242 · tokenized via QCB-licensed PSP" },
                  { id: "apple-pay", icon: "", label: t("applePay"), sub: "Touch ID / Face ID" },
                  { id: "wallet", icon: "👛", label: t("wallet_pm"), sub: "Balance: QAR 120" },
                  { id: "cash", icon: "💵", label: t("cash"), sub: "Pay the pro after completion" },
                ].map((m) => (
                  <button
                    key={m.id}
                    onClick={() => setPayMethod(m.id)}
                    className={`card w-full p-4 flex items-center gap-3 ${payMethod === m.id ? "!border-teal ring-2 ring-teal/30" : ""}`}
                  >
                    <span className="text-lg w-7">{m.icon || "🍎"}</span>
                    <span className="text-start flex-1">
                      <span className="block text-sm font-bold text-navy">{m.label}</span>
                      <span className="block text-xs text-navy-400">{m.sub}</span>
                    </span>
                    <span className={`h-4 w-4 rounded-full border-2 ${payMethod === m.id ? "bg-teal border-teal" : "border-navy-200"}`} />
                  </button>
                ))}
              </div>
              <div className="flex gap-2">
                <input
                  value={coupon}
                  onChange={(e) => {
                    setCoupon(e.target.value);
                    setCouponMsg(null);
                  }}
                  placeholder={`${t("couponPlaceholder")} (NEST10)`}
                  className="card flex-1 px-4 py-3 text-sm font-semibold text-navy outline-none"
                />
                <button onClick={applyCoupon} className="btn-ghost">{t("applyCoupon")}</button>
              </div>
              {couponMsg && (
                <p className={`text-xs font-semibold ${couponMsg.startsWith("✓") ? "text-teal" : "text-red-600"}`}>{couponMsg}</p>
              )}
              <PriceSummary />
              <p className="text-xs text-navy-400">
                Pre-authorized now, captured after completion · VAT-ready invoice by email · free cancellation up to 2h before.
              </p>
            </div>
            <div className="p-4 bg-white border-t border-navy-100">
              <button onClick={confirmAndPay} className="btn-gold w-full">
                {t("confirmPay")} · QAR {quote?.total ?? 0}
              </button>
            </div>
          </>
        );

      case "matching":
        return (
          <div className="flex-1 bg-navy-800 text-white flex flex-col items-center justify-center gap-5 px-8 text-center">
            <span className="relative flex h-24 w-24 items-center justify-center rounded-full bg-teal/20">
              <span className="absolute inset-0 rounded-full border-2 border-teal animate-ping" />
              <span className="text-3xl">✦</span>
            </span>
            <h2 className="font-display text-xl font-bold">{t("finding")}</h2>
            <p className="text-sm text-navy-200">
              Scoring nearby pros on skill, rating, distance, availability & language…
            </p>
            <div className="w-full max-w-[220px] space-y-2 text-xs text-navy-200 text-start">
              {["Location & availability", "Skill & certifications", "Rating & completion rate", "Language match"].map((s, i) => (
                <p key={s} className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-teal animate-pulse" style={{ animationDelay: `${i * 300}ms` }} />
                  {s}
                </p>
              ))}
            </div>
          </div>
        );

      case "confirmed": {
        const p = match?.provider;
        return (
          <div className="flex-1 flex flex-col px-6 pt-10 pb-6 overflow-y-auto phone-scroll">
            <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-teal text-white text-3xl">✓</span>
            <h2 className="font-display text-2xl font-bold text-navy text-center mt-4">{t("matchedTitle")}</h2>
            <p className="text-center text-xs text-navy-400 mt-1">
              {booking?.id} · {date === "today" ? t("today") : t("tomorrow")} {slot}
            </p>
            {p && (
              <div className="card p-4 mt-6 flex items-center gap-4">
                <span className="h-14 w-14 rounded-full bg-navy text-gold font-bold text-lg flex items-center justify-center">
                  {p.avatarInitials}
                </span>
                <div className="flex-1">
                  <p className="font-bold text-navy">{p.name}</p>
                  <p className="text-xs text-navy-400">
                    ★ {p.rating} · {p.jobsDone} jobs · {p.yearsExperience} yrs
                  </p>
                  <p className="text-xs mt-1">
                    <span className="chip bg-teal-soft text-teal-dark">✓ {t("verifiedPro")}</span>
                  </p>
                </div>
              </div>
            )}
            {match && (
              <div className="card p-4 mt-3 text-xs text-navy-500">
                <p className="font-bold text-navy mb-1">✦ Why Nest AI chose this pro</p>
                Match score {(match.score * 100).toFixed(0)}/100 — strongest on skill, rating and distance in {zone?.name}.
              </div>
            )}
            <button onClick={() => { setTrackStep(1); setScreen("tracking"); }} className="btn-primary mt-auto">
              {t("track")}
            </button>
          </div>
        );
      }

      case "tracking": {
        const p = match?.provider;
        const steps = ["Confirmed", "En route", "Arrived", "In progress"];
        return (
          <>
            <Header title={t("bookingConfirmed")} back="confirmed" />
            <div className="flex-1 overflow-y-auto phone-scroll">
              <div className="relative h-56 bg-teal-soft overflow-hidden">
                <div className="absolute inset-0 opacity-40" style={{ backgroundImage: "repeating-linear-gradient(0deg, transparent, transparent 26px, #12294B18 27px), repeating-linear-gradient(90deg, transparent, transparent 26px, #12294B18 27px)" }} />
                <svg viewBox="0 0 375 220" className="absolute inset-0 h-full w-full">
                  <path d="M40 190 C 120 160, 150 90, 330 40" fill="none" stroke="#0F9D8A" strokeWidth="4" strokeDasharray="10 7" strokeLinecap="round" />
                </svg>
                <span className="absolute" style={{ left: `${10 + trackStep * 18}%`, top: `${80 - trackStep * 14}%` }}>
                  <span className="block h-5 w-5 rounded-full bg-teal border-4 border-white pulse-dot" />
                </span>
                <span className="absolute top-6 right-8 text-xl">🏠</span>
                <span className="absolute bottom-3 start-3 chip bg-white text-navy shadow-card">
                  {t("etaLabel")} {Math.max(2, 18 - trackStep * 5)} min
                </span>
              </div>
              <div className="px-5 py-4 space-y-4">
                {p && (
                  <div className="card p-4 flex items-center gap-3">
                    <span className="h-12 w-12 rounded-full bg-navy text-gold font-bold flex items-center justify-center">{p.avatarInitials}</span>
                    <div className="flex-1">
                      <p className="font-bold text-navy text-sm">{p.name}</p>
                      <p className="text-xs text-navy-400">★ {p.rating} · {t("statusEnRoute")}</p>
                    </div>
                    <button onClick={() => setScreen("chat")} className="h-10 w-10 rounded-full bg-teal text-white">💬</button>
                    <button className="h-10 w-10 rounded-full bg-navy text-white">📞</button>
                  </div>
                )}
                <div className="card p-4">
                  {steps.map((s, i) => (
                    <div key={s} className="flex gap-3 items-start">
                      <div className="flex flex-col items-center">
                        <span className={`h-5 w-5 rounded-full flex items-center justify-center text-[10px] font-bold ${i < trackStep ? "bg-teal text-white" : "bg-navy-100 text-navy-300"}`}>
                          {i < trackStep ? "✓" : i + 1}
                        </span>
                        {i < steps.length - 1 && <span className={`w-0.5 h-6 ${i < trackStep - 1 ? "bg-teal" : "bg-navy-100"}`} />}
                      </div>
                      <p className={`text-sm font-semibold ${i < trackStep ? "text-navy" : "text-navy-300"}`}>{s}</p>
                    </div>
                  ))}
                </div>
                <button onClick={() => setScreen("rating")} className="btn-ghost w-full">
                  Simulate completion → {t("rateService")}
                </button>
              </div>
            </div>
          </>
        );
      }

      case "chat":
        return (
          <>
            <Header title={`💬 ${match?.provider.name ?? "Your pro"}`} back="tracking" />
            <div className="px-5 py-2 bg-teal-soft text-teal-dark text-[11px] font-semibold">
              ✦ AI translation on — messages shown in your language
            </div>
            <div className="flex-1 overflow-y-auto phone-scroll px-5 py-4 space-y-3">
              {chatMsgs.map((m, i) => (
                <div key={i} className={`max-w-[80%] ${m.from === "me" ? "ms-auto" : ""}`}>
                  <p className={`rounded-2xl px-4 py-2.5 text-sm ${m.from === "me" ? "bg-navy text-white rounded-ee-sm" : "bg-white border border-navy-100 text-navy rounded-ss-sm"}`}>
                    {lang === "ar" && m.translated ? m.translated : m.text}
                  </p>
                  {m.from === "them" && m.translated && lang !== "ar" && (
                    <p className="text-[10px] text-navy-300 mt-1 px-2" dir="rtl">{m.translated}</p>
                  )}
                </div>
              ))}
            </div>
            <div className="p-3 bg-white border-t border-navy-100 flex gap-2">
              <input
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && sendChat()}
                placeholder="Message…"
                className="flex-1 rounded-xl bg-pearl px-4 py-2.5 text-sm outline-none"
              />
              <button onClick={sendChat} className="btn-primary !py-2.5">{t("send")}</button>
            </div>
          </>
        );

      case "rating":
        return (
          <div className="flex-1 flex flex-col px-6 pt-10 pb-6">
            {!ratingDone ? (
              <>
                <h2 className="font-display text-2xl font-bold text-navy text-center">{t("rateService")}</h2>
                <p className="text-center text-xs text-navy-400 mt-1">{t("rateHint")}</p>
                <div className="flex justify-center gap-2 mt-8" dir="ltr">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button key={n} onClick={() => setStars(n)} className={`text-4xl ${n <= stars ? "" : "grayscale opacity-40"}`}>
                      ⭐
                    </button>
                  ))}
                </div>
                <div className="flex flex-wrap justify-center gap-2 mt-8">
                  {["On time", "Professional", "Great quality", "Clean & tidy", "Friendly"].map((tag) => (
                    <span key={tag} className="chip bg-white border border-navy-100 text-navy">{tag}</span>
                  ))}
                </div>
                <button
                  disabled={stars === 0}
                  onClick={async () => {
                    if (booking) {
                      await fetch(`/api/bookings/${booking.id}`, {
                        method: "PATCH",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ status: "completed", rating: stars }),
                      }).catch(() => null);
                    }
                    setRatingDone(true);
                  }}
                  className="btn-primary mt-auto"
                >
                  {t("submit")}
                </button>
              </>
            ) : (
              <>
                <span className="mx-auto mt-16 flex h-16 w-16 items-center justify-center rounded-full bg-gold text-navy-800 text-3xl">🎉</span>
                <h2 className="font-display text-2xl font-bold text-navy text-center mt-4">{t("thanks")}</h2>
                <p className="text-center text-sm text-navy-400 mt-2">
                  +15 QAR wallet credit earned · quality score updated for {match?.provider.name ?? "your pro"}.
                </p>
                <button onClick={() => { setRatingDone(false); setStars(0); setScreen("home"); }} className="btn-gold mt-auto">
                  {t("bookAgain")}
                </button>
              </>
            )}
          </div>
        );

      case "bookings":
        return (
          <>
            <Header title={t("bookings")} />
            <div className="flex-1 overflow-y-auto phone-scroll px-5 py-4 space-y-3">
              {(booking
                ? [{ b: booking, status: "Active", tone: "bg-teal-soft text-teal-dark" }]
                : []
              )
                .concat([
                  { b: { id: "NB-1037", serviceId: "salon", slot: "16:00" } as unknown as Booking, status: "Completed", tone: "bg-navy-50 text-navy-400" },
                  { b: { id: "NB-1035", serviceId: "electrical", slot: "19:00" } as unknown as Booking, status: "Completed", tone: "bg-navy-50 text-navy-400" },
                  { b: { id: "NB-1033", serviceId: "nanny", slot: "13:00" } as unknown as Booking, status: "Completed", tone: "bg-navy-50 text-navy-400" },
                ])
                .map(({ b, status, tone }) => {
                  const s = getService(b.serviceId);
                  return (
                    <button
                      key={b.id}
                      onClick={() => status === "Active" && setScreen("tracking")}
                      className="card w-full p-4 flex items-center gap-3 text-start"
                    >
                      <span className={`h-11 w-11 rounded-full flex items-center justify-center text-lg ${s ? accentBg(s.accent) : "bg-navy"}`}>
                        {s?.icon ?? "❔"}
                      </span>
                      <span className="flex-1">
                        <span className="block text-sm font-bold text-navy">{s?.name}</span>
                        <span className="block text-xs text-navy-400">{b.id} · {b.slot}</span>
                      </span>
                      <span className={`chip ${tone}`}>{status}</span>
                    </button>
                  );
                })}
              <button onClick={() => setScreen("home")} className="btn-ghost w-full">+ {t("bookNow")}</button>
            </div>
            <BottomNav />
          </>
        );

      case "assistant":
        return (
          <>
            <Header title={`✦ ${t("assistant")}`} />
            <div className="flex-1 overflow-y-auto phone-scroll px-5 py-4 space-y-3">
              <div className="max-w-[85%]">
                <p className="rounded-2xl rounded-ss-sm bg-white border border-navy-100 px-4 py-2.5 text-sm text-navy">
                  {t("aiGreeting")}
                </p>
              </div>
              {aiMsgs.map((m, i) => (
                <div key={i} className={`max-w-[85%] ${m.from === "me" ? "ms-auto" : ""}`}>
                  <p className={`rounded-2xl px-4 py-2.5 text-sm ${m.from === "me" ? "bg-navy text-white rounded-ee-sm" : "bg-white border border-navy-100 text-navy rounded-ss-sm"}`}>
                    {m.text}
                  </p>
                  {m.serviceId && (
                    <button
                      onClick={() => {
                        const s = getService(m.serviceId!);
                        if (s) openService(s);
                      }}
                      className="mt-2 btn-gold !py-2 !px-3 text-xs"
                    >
                      {t("bookNow")}: {getService(m.serviceId)?.name} →
                    </button>
                  )}
                </div>
              ))}
              {aiBusy && <p className="text-xs text-navy-300 animate-pulse">Nest AI is thinking…</p>}
              <div className="flex flex-wrap gap-2 pt-2">
                {["My AC is not cooling", "Deep clean before moving in", "I saw cockroaches in the kitchen"].map((q) => (
                  <button key={q} onClick={() => setAiInput(q)} className="chip bg-white border border-navy-100 text-navy">
                    {q}
                  </button>
                ))}
              </div>
            </div>
            <div className="p-3 bg-white border-t border-navy-100 flex gap-2">
              <input
                value={aiInput}
                onChange={(e) => setAiInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && sendAi()}
                placeholder={t("aiPlaceholder")}
                className="flex-1 rounded-xl bg-pearl px-4 py-2.5 text-sm outline-none"
              />
              <button onClick={sendAi} disabled={aiBusy} className="btn-primary !py-2.5">{t("send")}</button>
            </div>
            <BottomNav />
          </>
        );

      case "account":
        return (
          <>
            <Header title={t("account")} />
            <div className="flex-1 overflow-y-auto phone-scroll px-5 py-4 space-y-3">
              <div className="card p-4 flex items-center gap-4">
                <span className="h-14 w-14 rounded-full bg-gold text-navy-800 font-bold text-lg flex items-center justify-center">SJ</span>
                <div>
                  <p className="font-bold text-navy">Demo Customer</p>
                  <p className="text-xs text-navy-400" dir="ltr">+974 {phone || "5555 1234"} · {zone?.name}</p>
                </div>
              </div>
              {[
                { id: "wallet" as Screen, icon: "👛", label: t("wallet"), sub: "QAR 120 + 2 coupons" },
                { id: "subscriptions" as Screen, icon: "⭐", label: t("subscriptions"), sub: "Home-care plans & AMC" },
                { id: "profile" as Screen, icon: "👨‍👩‍👧", label: t("profile"), sub: "Addresses & family members" },
                { id: "help" as Screen, icon: "🛟", label: t("help"), sub: "AI-classified, human-resolved" },
              ].map((item) => (
                <button key={item.id} onClick={() => setScreen(item.id)} className="card w-full p-4 flex items-center gap-3 text-start">
                  <span className="text-xl w-8">{item.icon}</span>
                  <span className="flex-1">
                    <span className="block text-sm font-bold text-navy">{item.label}</span>
                    <span className="block text-xs text-navy-400">{item.sub}</span>
                  </span>
                  <span className="text-navy-300">{dir === "rtl" ? "‹" : "›"}</span>
                </button>
              ))}
              <button onClick={() => setScreen("language")} className="card w-full p-4 flex items-center gap-3 text-start">
                <span className="text-xl w-8">🌐</span>
                <span className="flex-1 text-sm font-bold text-navy">
                  {LANGUAGES.find((l) => l.code === lang)?.native}
                </span>
                <span className="text-navy-300">{dir === "rtl" ? "‹" : "›"}</span>
              </button>
            </div>
            <BottomNav />
          </>
        );

      case "wallet":
        return (
          <>
            <Header title={t("wallet")} back="account" />
            <div className="flex-1 overflow-y-auto phone-scroll px-5 py-4 space-y-3">
              <div className="rounded-2xl bg-navy-800 text-white p-5">
                <p className="text-xs text-navy-200">Nest Wallet balance</p>
                <p className="font-display text-3xl font-bold mt-1">QAR 120</p>
                <p className="text-xs text-navy-200 mt-3">+ QAR 15 earned from your last rating</p>
              </div>
              <h3 className="font-display font-bold text-navy pt-2">Coupons</h3>
              {Object.entries(COUPONS).map(([code, c]) => (
                <div key={code} className="card p-4 flex items-center justify-between border-dashed">
                  <div>
                    <p className="font-mono font-bold text-navy">{code}</p>
                    <p className="text-xs text-navy-400">{c.label}</p>
                  </div>
                  <button onClick={() => { setCoupon(code); setScreen("payment"); }} className="chip bg-gold-soft text-gold-dark">
                    Use
                  </button>
                </div>
              ))}
            </div>
            <BottomNav />
          </>
        );

      case "subscriptions":
        return (
          <>
            <Header title={t("subscriptions")} back="account" />
            <div className="flex-1 overflow-y-auto phone-scroll px-5 py-4 space-y-3">
              {[
                { name: "Nest+ Essential", price: 199, features: ["2 cleans / month", "10% off all services", "Priority slots"], accent: "bg-teal" },
                { name: "Nest+ Family", price: 449, features: ["4 cleans / month", "1 AC service / quarter", "15% off · family profiles"], accent: "bg-navy", popular: true },
                { name: "Villa AMC", price: 899, features: ["Annual maintenance contract", "AC + plumbing + electrical cover", "48h SLA with rework guarantee"], accent: "bg-gold" },
              ].map((p) => (
                <div key={p.name} className={`card p-5 ${p.popular ? "!border-gold ring-2 ring-gold/30" : ""}`}>
                  {p.popular && <span className="chip bg-gold text-navy-800 mb-2">★ Most popular</span>}
                  <div className="flex items-baseline justify-between">
                    <p className="font-display font-bold text-navy">{p.name}</p>
                    <p className="font-bold text-navy">QAR {p.price}<span className="text-xs text-navy-400">/mo</span></p>
                  </div>
                  <ul className="mt-2 space-y-1 text-xs text-navy-500">
                    {p.features.map((f) => <li key={f}>✓ {f}</li>)}
                  </ul>
                  <button className={`mt-3 w-full rounded-xl py-2.5 text-sm font-bold text-white ${p.accent} ${p.accent === "bg-gold" ? "!text-navy-800" : ""}`}>
                    Subscribe
                  </button>
                </div>
              ))}
            </div>
            <BottomNav />
          </>
        );

      case "help":
        return (
          <>
            <Header title={t("help")} back="account" />
            <div className="flex-1 overflow-y-auto phone-scroll px-5 py-4 space-y-3">
              <p className="text-xs text-navy-400">
                Describe the issue — Nest AI classifies it instantly and routes serious cases straight to our human operations team.
              </p>
              <textarea
                value={complaint}
                onChange={(e) => setComplaint(e.target.value)}
                rows={4}
                placeholder="e.g. The provider arrived 40 minutes late and the sofa got stained…"
                className="card w-full px-4 py-3 text-sm text-navy outline-none resize-none"
              />
              <button onClick={submitComplaint} className="btn-primary w-full" disabled={!complaint.trim()}>
                {t("submit")}
              </button>
              {complaintResult && (
                <div className="card p-4 space-y-2 text-sm">
                  <p className="font-bold text-navy">✦ AI triage result</p>
                  <p className="flex flex-wrap gap-2">
                    <span className="chip bg-navy text-white">{complaintResult.category.replace(/_/g, " ")}</span>
                    <span className={`chip ${complaintResult.priority === "critical" || complaintResult.priority === "high" ? "bg-red-100 text-red-700" : "bg-gold-soft text-gold-dark"}`}>
                      {complaintResult.priority} priority
                    </span>
                  </p>
                  <p className="text-xs text-navy-500">
                    {complaintResult.humanEscalation
                      ? "→ Escalated to a human specialist — you'll get a call within 30 minutes. A refund review is open."
                      : "→ Logged with the booking. Our team responds within 4 hours; rework is free under the guarantee."}
                  </p>
                </div>
              )}
            </div>
            <BottomNav />
          </>
        );

      case "profile":
        return (
          <>
            <Header title={t("profile")} back="account" />
            <div className="flex-1 overflow-y-auto phone-scroll px-5 py-4 space-y-3">
              <div className="card p-4">
                <p className="text-xs font-semibold text-navy-400 mb-2">Saved addresses</p>
                {[
                  { label: "🏠 Home", addr: "Marina Tower 12, Apt 804 — West Bay" },
                  { label: "🏢 Office", addr: "Tornado Tower, Floor 22 — West Bay" },
                ].map((a) => (
                  <p key={a.label} className="py-2 border-b border-navy-50 last:border-0 text-sm">
                    <span className="font-bold text-navy">{a.label}</span>
                    <span className="block text-xs text-navy-400">{a.addr}</span>
                  </p>
                ))}
              </div>
              <div className="card p-4">
                <p className="text-xs font-semibold text-navy-400 mb-2">Family members</p>
                {[
                  { name: "Amina (spouse)", note: "Can book & track all services" },
                  { name: "Yusuf (son, 6)", note: "Nanny bookings — female providers only" },
                  { name: "Abu Khalid (father)", note: "Elderly care — Arabic-speaking companions" },
                ].map((m) => (
                  <p key={m.name} className="py-2 border-b border-navy-50 last:border-0 text-sm">
                    <span className="font-bold text-navy">{m.name}</span>
                    <span className="block text-xs text-navy-400">{m.note}</span>
                  </p>
                ))}
              </div>
              <div className="card p-4 text-sm flex items-center justify-between">
                <span className="font-bold text-navy">Female-provider preference</span>
                <span className="h-6 w-11 rounded-full bg-teal p-0.5"><span className="block h-5 w-5 rounded-full bg-white translate-x-5 rtl:-translate-x-5" /></span>
              </div>
            </div>
            <BottomNav />
          </>
        );
    }
  }

  /* ---------------------------------------------------------------- */
  /* Page shell: phone + screen map                                    */
  /* ---------------------------------------------------------------- */

  return (
    <main className="min-h-screen bg-navy-900 py-10 px-6">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-8 text-white">
          <div>
            <Link href="/" className="text-xs text-navy-300 hover:text-white">← NEST Solutions</Link>
            <h1 className="font-display text-2xl font-bold mt-1">Customer app — interactive wireframe</h1>
            <p className="text-sm text-navy-300">
              Full booking journey with live pricing, AI matching and 6-language RTL support.
            </p>
          </div>
        </div>

        <div className="grid lg:grid-cols-[260px_1fr] gap-10 items-start">
          {/* Screen map for wireframe navigation */}
          <aside className="rounded-2xl bg-navy-800 p-5 text-sm sticky top-6 max-h-[80vh] overflow-y-auto phone-scroll">
            <p className="kicker-gold mb-3">Screen map</p>
            {SCREEN_MAP.map((g) => (
              <div key={g.group} className="mb-4">
                <p className="text-[11px] font-bold uppercase tracking-wider text-navy-300 mb-1.5">{g.group}</p>
                {g.screens.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => setScreen(s.id)}
                    className={`block w-full text-start rounded-lg px-3 py-1.5 mb-0.5 ${
                      screen === s.id ? "bg-teal text-white font-semibold" : "text-navy-100 hover:bg-white/5"
                    }`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            ))}
            <p className="text-[11px] text-navy-400 border-t border-white/10 pt-3">
              Language: <b className="text-white">{LANGUAGES.find((l) => l.code === lang)?.native}</b>
              {isRtl(lang) ? " · RTL active" : ""}
            </p>
          </aside>

          <PhoneFrame dir={dir} accent={screen === "splash" || screen === "matching" ? "navy" : "light"}>
            {renderScreen()}
          </PhoneFrame>
        </div>
      </div>
    </main>
  );
}
