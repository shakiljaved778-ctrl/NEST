import Link from "next/link";
import { SERVICES, ZONES } from "@/lib/catalog";

const PRODUCTS = [
  {
    href: "/customer",
    icon: "📱",
    title: "Customer app",
    accent: "bg-teal",
    desc: "Browse, compare, book, pay, live-track the provider, chat with translation, rate, rebook and subscribe to home-care plans.",
    cta: "Open the customer app",
  },
  {
    href: "/provider",
    icon: "🪪",
    title: "Provider app",
    accent: "bg-gold",
    desc: "Onboarding & KYC, job requests, calendar, navigation, service checklists, before/after photos, earnings & training — offline-first.",
    cta: "Open the provider app",
  },
  {
    href: "/admin",
    icon: "📊",
    title: "Admin & Ops",
    accent: "bg-navy",
    desc: "Live booking map, provider verification, pricing engine, disputes, refunds, coupons, revenue analytics and demand heatmaps.",
    cta: "Open the dashboard",
  },
  {
    href: "/customer?screen=assistant",
    icon: "🧠",
    title: "AI layer",
    accent: "bg-teal",
    desc: "Booking assistant, provider matching, dynamic pricing, complaint classifier, quality scoring, 6-language translation & fraud detection.",
    cta: "Try Nest AI",
  },
];

const FLOW = [
  "Select zone",
  "Choose service",
  "Pick package & add-ons",
  "Schedule",
  "AI price quote",
  "Pay securely",
  "AI matches your pro",
  "Live tracking",
  "Checklist & photos",
  "Rate & rebook",
];

export default function Landing() {
  return (
    <main className="min-h-screen">
      {/* Hero */}
      <section className="bg-navy-800 text-white relative overflow-hidden">
        <div className="absolute -top-24 -right-24 h-96 w-96 rounded-full bg-navy-600/50" />
        <div className="absolute -bottom-32 -left-16 h-80 w-80 rounded-full bg-teal-dark/30" />
        <div className="relative max-w-6xl mx-auto px-6 py-20">
          <div className="flex items-center gap-3 mb-8">
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-gold text-navy-800 text-2xl">⌂</span>
            <span className="font-display text-2xl font-bold tracking-wide">NEST SOLUTIONS</span>
          </div>
          <p className="kicker-gold mb-3">Qatar's AI-powered trusted home-services super app</p>
          <h1 className="font-display text-4xl md:text-5xl font-bold leading-tight max-w-3xl">
            One app for a trusted home.
          </h1>
          <p className="mt-5 max-w-2xl text-navy-100 text-lg">
            Verified professionals, transparent prices, and AI that books the right service in
            seconds — across {SERVICES.length} home services and {ZONES.length} Qatar zones.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/customer" className="btn-gold">Launch customer app</Link>
            <Link href="/admin" className="btn-ghost !border-white/30 !text-white hover:!bg-white/10">
              Operations dashboard
            </Link>
          </div>
          <div className="mt-10 flex flex-wrap gap-2 text-xs text-navy-100">
            {["EN", "العربية", "हिन्दी", "اردو", "മലയാളം", "Tagalog"].map((l) => (
              <span key={l} className="chip bg-white/10">{l}</span>
            ))}
            <span className="chip bg-teal/20 text-teal-light">Full Arabic RTL</span>
            <span className="chip bg-gold/20 text-gold-light">Verified providers</span>
          </div>
        </div>
      </section>

      {/* Four connected products */}
      <section className="max-w-6xl mx-auto px-6 py-16">
        <p className="kicker mb-2">Product highlights</p>
        <h2 className="font-display text-3xl font-bold text-navy mb-8">
          One super app, four connected products
        </h2>
        <div className="grid gap-5 md:grid-cols-2">
          {PRODUCTS.map((p) => (
            <Link key={p.title} href={p.href} className="card p-6 flex gap-5 hover:-translate-y-0.5 transition group">
              <span className={`h-14 w-14 shrink-0 rounded-full ${p.accent} text-white flex items-center justify-center text-2xl`}>
                {p.icon}
              </span>
              <span>
                <span className="font-display text-xl font-bold text-navy block">{p.title}</span>
                <span className="text-sm text-navy-500 mt-1 block">{p.desc}</span>
                <span className="text-sm font-semibold text-teal mt-3 inline-block group-hover:underline">
                  {p.cta} →
                </span>
              </span>
            </Link>
          ))}
        </div>
      </section>

      {/* 15 services */}
      <section className="bg-white border-y border-navy-100">
        <div className="max-w-6xl mx-auto px-6 py-16">
          <p className="kicker-gold mb-2">Services provided</p>
          <h2 className="font-display text-3xl font-bold text-navy mb-8">
            15 home services, one trusted platform
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
            {SERVICES.map((s) => (
              <Link
                key={s.id}
                href={`/customer?service=${s.id}`}
                className="card !bg-pearl p-4 text-center hover:-translate-y-0.5 transition"
              >
                <span
                  className={`mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full text-xl ${
                    s.accent === "teal" ? "bg-teal text-white" : s.accent === "gold" ? "bg-gold text-navy-800" : "bg-navy text-white"
                  }`}
                >
                  {s.icon}
                </span>
                <span className="block text-sm font-bold text-navy">{s.name}</span>
                <span className="block text-xs text-navy-400 mt-1" dir="rtl">{s.nameAr}</span>
              </Link>
            ))}
          </div>
          <p className="mt-6 text-sm text-navy-500">
            <span className="font-semibold text-gold-dark">Every service ships with:</span> fixed packages
            & add-ons · materials clarity · gender preference where available · warranty / rework ·
            cancellation policy
          </p>
        </div>
      </section>

      {/* Booking flow */}
      <section className="max-w-6xl mx-auto px-6 py-16">
        <p className="kicker mb-2">End-to-end booking flow</p>
        <h2 className="font-display text-3xl font-bold text-navy mb-8">
          From “my AC is not cooling” to a five-star visit
        </h2>
        <ol className="flex flex-wrap gap-3">
          {FLOW.map((step, i) => (
            <li key={step} className="card px-4 py-3 flex items-center gap-3 text-sm font-semibold text-navy">
              <span className={`flex h-7 w-7 items-center justify-center rounded-full text-xs text-white ${i % 2 ? "bg-gold !text-navy-800" : "bg-teal"}`}>
                {i + 1}
              </span>
              {step}
            </li>
          ))}
        </ol>
      </section>

      {/* Launch zones + footer */}
      <section className="bg-navy-800 text-white">
        <div className="max-w-6xl mx-auto px-6 py-14">
          <p className="kicker-gold mb-2">Go-to-market</p>
          <h2 className="font-display text-2xl font-bold mb-6">Win Doha zone-by-zone, then all of Qatar</h2>
          <div className="flex flex-wrap gap-2">
            {ZONES.map((z) => (
              <span key={z.id} className={`chip ${z.wave === 1 ? "bg-gold text-navy-800" : "bg-white/10 text-navy-100"}`}>
                {z.name} · {z.nameAr}{z.wave === 1 ? " · beachhead" : ""}
              </span>
            ))}
          </div>
          <p className="mt-10 text-sm text-navy-200">
            NEST SOLUTIONS · Doha, Qatar · Founders: Shakil Javed (CEO) · Athar Shadab (COO)
          </p>
        </div>
      </section>
    </main>
  );
}
