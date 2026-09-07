"use client";

import Link from "next/link";
import {
  home,
  projects,
  packages,
  processSteps,
  whatsappLink,
} from "@/data/content";
import { useLang } from "@/components/LanguageProvider";
import Reveal from "@/components/Reveal";
import PortfolioCard from "@/components/PortfolioCard";

export default function HomeView() {
  const { t } = useLang();
  const featured = projects.slice(0, 6);

  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="wrap py-20 sm:py-28">
          <Reveal>
            <span className="kicker">{home.heroKicker}</span>
          </Reveal>
          <Reveal delay={80}>
            <h1 className="mt-5 max-w-4xl font-display text-4xl leading-[1.1] sm:text-6xl">
              {home.heroTitle}
            </h1>
          </Reveal>
          <Reveal delay={160}>
            <p className="mt-6 max-w-2xl text-lg text-cream/75">
              {home.heroSub}
            </p>
          </Reveal>
          <Reveal delay={240}>
            <div className="mt-9 flex flex-wrap gap-3">
              <Link href="/start" className="btn-gold">
                {t("cta.start")}
              </Link>
              <a href="#work" className="btn-outline">
                {t("cta.seeWork")}
              </a>
            </div>
          </Reveal>
        </div>
      </section>

      {/* Trust strip */}
      <section className="border-y border-white/10 bg-white/[0.02]">
        <div className="wrap flex flex-wrap items-center justify-center gap-x-8 gap-y-3 py-4 text-sm text-cream/70">
          {home.trustStrip.map((item, i) => (
            <span key={item} className="flex items-center gap-8">
              <span className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-gold" />
                {item}
              </span>
            </span>
          ))}
        </div>
      </section>

      {/* Featured portfolio */}
      <section id="work" className="wrap scroll-mt-20 py-20">
        <Reveal>
          <div className="flex items-end justify-between gap-4">
            <div>
              <span className="kicker">Selected work</span>
              <h2 className="mt-3 font-display text-3xl sm:text-4xl">
                Recent projects
              </h2>
            </div>
            <Link href="/work" className="hidden shrink-0 text-sm font-semibold text-gold link-underline sm:inline">
              View all →
            </Link>
          </div>
        </Reveal>
        <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {featured.map((p, i) => (
            <Reveal key={p.slug} delay={(i % 3) * 80}>
              <PortfolioCard project={p} />
            </Reveal>
          ))}
        </div>
        <div className="mt-8 sm:hidden">
          <Link href="/work" className="btn-outline w-full">View all work →</Link>
        </div>
      </section>

      {/* Services summary */}
      <section className="wrap py-16">
        <div className="rule mb-16" />
        <Reveal>
          <span className="kicker">What we do</span>
          <h2 className="mt-3 font-display text-3xl sm:text-4xl">Three ways to start</h2>
          <p className="mt-4 max-w-2xl text-cream/70">{home.servicesIntro}</p>
        </Reveal>
        <div className="mt-10 grid gap-6 md:grid-cols-3">
          {packages.map((pkg, i) => (
            <Reveal key={pkg.id} delay={i * 80}>
              <div
                className={`panel h-full p-6 ${
                  pkg.highlighted ? "border-gold/40 bg-gold/[0.06]" : ""
                }`}
              >
                {pkg.highlighted && (
                  <span className="mb-3 inline-block rounded-full bg-gold px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide text-navy-800">
                    Most popular
                  </span>
                )}
                <h3 className="font-display text-xl">{pkg.name}</h3>
                <p className="mt-2 font-display text-2xl text-gold">{pkg.priceQAR}</p>
                <p className="mt-3 text-sm text-cream/70">{pkg.tagline}</p>
                <Link
                  href="/services"
                  className="mt-5 inline-block text-sm font-semibold text-gold link-underline"
                >
                  See what's included →
                </Link>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* Process */}
      <section className="wrap py-16">
        <div className="rule mb-16" />
        <Reveal>
          <span className="kicker">How it works</span>
          <h2 className="mt-3 font-display text-3xl sm:text-4xl">
            Brief → Design → Build → Launch
          </h2>
        </Reveal>
        <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {processSteps.map((step, i) => (
            <Reveal key={step.n} delay={i * 80}>
              <div className="panel h-full p-6">
                <div className="flex items-baseline justify-between">
                  <span className="font-display text-3xl text-gold/70">{step.n}</span>
                  <span className="text-xs font-semibold uppercase tracking-wide text-cream/50">
                    {step.time}
                  </span>
                </div>
                <h3 className="mt-3 font-display text-lg">{step.title}</h3>
                <p className="mt-2 text-sm text-cream/70">{step.body}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* Pricing teaser + final CTA */}
      <section className="wrap py-20">
        <Reveal>
          <div className="relative overflow-hidden rounded-xl2 border border-gold/25 bg-gradient-to-br from-navy-600/60 to-navy-800/60 p-10 text-center sm:p-16">
            <span className="kicker">Fixed pricing from QAR 3,500</span>
            <h2 className="mx-auto mt-4 max-w-2xl font-display text-3xl sm:text-4xl">
              {home.finalCtaTitle}
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-cream/75">{home.finalCtaSub}</p>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <Link href="/start" className="btn-gold">{t("cta.start")}</Link>
              <a
                href={whatsappLink()}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-outline"
              >
                {t("cta.whatsapp")}
              </a>
            </div>
          </div>
        </Reveal>
      </section>
    </>
  );
}
