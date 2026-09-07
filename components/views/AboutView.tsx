"use client";

import Link from "next/link";
import { about, whatsappLink } from "@/data/content";
import { useLang } from "@/components/LanguageProvider";
import Reveal from "@/components/Reveal";

export default function AboutView() {
  const { t } = useLang();
  return (
    <section className="wrap py-16 sm:py-20">
      <div className="grid gap-12 lg:grid-cols-[1.4fr_1fr] lg:items-start">
        <div>
          <Reveal>
            <span className="kicker">{about.kicker}</span>
            <h1 className="mt-3 font-display text-4xl leading-tight sm:text-5xl">
              {about.title}
            </h1>
          </Reveal>
          <Reveal delay={100}>
            <p className="mt-6 text-lg text-cream/80">{about.lead}</p>
          </Reveal>
          <div className="mt-6 space-y-4 text-cream/70">
            {about.paragraphs.map((p, i) => (
              <Reveal key={i} delay={150 + i * 60}>
                <p>{p}</p>
              </Reveal>
            ))}
          </div>
        </div>

        {/* Monogram mark instead of a stock team photo */}
        <Reveal delay={120}>
          <div className="panel grid aspect-square place-items-center p-10">
            <div className="text-center">
              <div className="mx-auto grid h-28 w-28 place-items-center rounded-2xl border-2 border-gold/50 font-display text-5xl text-gold">
                QS
              </div>
              <p className="mt-6 font-display text-xl">QatarStore</p>
              <p className="mt-1 text-sm text-cream/55">Doha · Est. 2024</p>
              <p className="mt-1 text-xs uppercase tracking-widest text-cream/40">
                Founder-led studio
              </p>
            </div>
          </div>
        </Reveal>
      </div>

      {/* Values */}
      <div className="mt-16">
        <div className="rule mb-12" />
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {about.values.map((v, i) => (
            <Reveal key={v.title} delay={i * 70}>
              <div className="panel h-full p-6">
                <h3 className="font-display text-lg text-gold">{v.title}</h3>
                <p className="mt-2 text-sm text-cream/70">{v.body}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>

      {/* CTA */}
      <Reveal>
        <div className="mt-16 rounded-xl2 border border-gold/25 bg-gradient-to-br from-navy-600/60 to-navy-800/60 p-10 text-center">
          <h2 className="font-display text-2xl sm:text-3xl">Let's build yours.</h2>
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
