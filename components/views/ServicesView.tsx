"use client";

import Link from "next/link";
import { packages, addOns, servicesPage, whatsappLink } from "@/data/content";
import { useLang } from "@/components/LanguageProvider";
import Reveal from "@/components/Reveal";

function Check() {
  return (
    <svg viewBox="0 0 20 20" className="mt-0.5 h-4 w-4 shrink-0 text-gold" fill="none">
      <path d="M4 10.5l3.5 3.5L16 5.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function ServicesView() {
  const { t } = useLang();

  return (
    <section className="wrap py-16 sm:py-20">
      <Reveal>
        <span className="kicker">{servicesPage.kicker}</span>
        <h1 className="mt-3 font-display text-4xl sm:text-5xl">{servicesPage.title}</h1>
        <p className="mt-4 max-w-2xl text-cream/75">{servicesPage.sub}</p>
      </Reveal>

      {/* Packages */}
      <div className="mt-12 grid gap-6 lg:grid-cols-3">
        {packages.map((pkg, i) => (
          <Reveal key={pkg.id} delay={i * 90}>
            <div
              className={`flex h-full flex-col rounded-xl2 border p-7 ${
                pkg.highlighted
                  ? "border-gold/50 bg-gold/[0.07] shadow-lift"
                  : "border-white/10 bg-white/[0.03]"
              }`}
            >
              {pkg.highlighted && (
                <span className="mb-4 self-start rounded-full bg-gold px-3 py-0.5 text-[11px] font-bold uppercase tracking-wide text-navy-800">
                  Most popular
                </span>
              )}
              <h2 className="font-display text-2xl">{pkg.name}</h2>
              <p className="mt-3 font-display text-4xl text-gold">{pkg.priceQAR}</p>
              <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-cream/50">
                {pkg.delivery}
              </p>
              <p className="mt-4 text-sm text-cream/70">{pkg.tagline}</p>
              <ul className="mt-6 flex-1 space-y-3 text-sm">
                {pkg.features.map((f) => (
                  <li key={f} className="flex gap-2.5 text-cream/80">
                    <Check />
                    {f}
                  </li>
                ))}
              </ul>
              <Link
                href={`/start?package=${pkg.id}`}
                className={`mt-7 w-full ${pkg.highlighted ? "btn-gold" : "btn-outline"}`}
              >
                {t("cta.start")}
              </Link>
            </div>
          </Reveal>
        ))}
      </div>

      {/* Add-ons */}
      <div className="mt-16">
        <div className="rule mb-10" />
        <Reveal>
          <h2 className="font-display text-2xl">Add-ons</h2>
          <p className="mt-2 text-sm text-cream/65">
            Bolt any of these onto any package.
          </p>
        </Reveal>
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {addOns.map((a, i) => (
            <Reveal key={a.name} delay={i * 60}>
              <div className="panel flex items-center justify-between p-5">
                <span className="text-sm text-cream/85">{a.name}</span>
                <span className="text-sm font-semibold text-gold">{a.price}</span>
              </div>
            </Reveal>
          ))}
        </div>
      </div>

      {/* CTA */}
      <Reveal>
        <div className="mt-16 rounded-xl2 border border-gold/25 bg-gradient-to-br from-navy-600/60 to-navy-800/60 p-10 text-center">
          <h2 className="font-display text-2xl sm:text-3xl">Not sure which package?</h2>
          <p className="mx-auto mt-3 max-w-lg text-cream/75">
            Start the brief and we'll recommend the right fit — or ask us on WhatsApp.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Link href="/start" className="btn-gold">{t("cta.start")}</Link>
            <a href={whatsappLink()} target="_blank" rel="noopener noreferrer" className="btn-outline">
              {t("cta.whatsapp")}
            </a>
          </div>
        </div>
      </Reveal>
    </section>
  );
}
