"use client";

import { site, contactPage, whatsappLink } from "@/data/content";
import { useLang } from "@/components/LanguageProvider";
import Reveal from "@/components/Reveal";

export default function ContactView() {
  const { t } = useLang();

  return (
    <section className="wrap py-16 sm:py-20">
      <Reveal>
        <span className="kicker">{contactPage.kicker}</span>
        <h1 className="mt-3 font-display text-4xl sm:text-5xl">{contactPage.title}</h1>
        <p className="mt-4 max-w-2xl text-cream/75">{contactPage.sub}</p>
      </Reveal>

      <div className="mt-12 grid gap-6 lg:grid-cols-[1fr_1.2fr]">
        {/* Contact channels */}
        <div className="space-y-4">
          {/* WhatsApp — primary */}
          <Reveal>
            <a
              href={whatsappLink()}
              target="_blank"
              rel="noopener noreferrer"
              className="block rounded-xl2 border border-gold/40 bg-gold/[0.07] p-6 transition hover:bg-gold/[0.12]"
            >
              <span className="text-xs font-semibold uppercase tracking-widest text-gold">
                Fastest — recommended
              </span>
              <p className="mt-2 font-display text-2xl">Chat on WhatsApp</p>
              <p className="mt-1 text-sm text-cream/70">
                Message the studio directly. We usually reply within a few hours.
              </p>
              <span className="btn-gold mt-4">{t("cta.whatsapp")}</span>
            </a>
          </Reveal>

          <Reveal delay={80}>
            <div className="grid gap-4 sm:grid-cols-2">
              <ContactCard label="Phone" value={site.phoneDisplay} href={`tel:${site.phoneHref}`} />
              <ContactCard label="Email" value={site.email} href={`mailto:${site.email}`} />
            </div>
          </Reveal>

          <Reveal delay={140}>
            <div className="panel p-6">
              <h3 className="font-display text-lg">Service area</h3>
              <p className="mt-2 text-sm text-cream/75">{site.serviceArea}</p>
              <h3 className="mt-5 font-display text-lg">Business hours</h3>
              <p className="mt-2 text-sm text-cream/75">{site.businessHours}</p>
              <p className="mt-1 text-xs text-cream/45">
                Qatar work week — Sunday to Thursday.
              </p>
            </div>
          </Reveal>
        </div>

        {/* Map */}
        <Reveal delay={100}>
          <div className="h-full min-h-[360px] overflow-hidden rounded-xl2 border border-white/10">
            <iframe
              title="QatarStore location — Doha, Qatar"
              src="https://www.google.com/maps?q=Doha%2C%20Qatar&z=11&output=embed"
              className="h-full min-h-[360px] w-full"
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
            />
          </div>
        </Reveal>
      </div>
    </section>
  );
}

function ContactCard({
  label,
  value,
  href,
}: {
  label: string;
  value: string;
  href: string;
}) {
  return (
    <a href={href} className="panel block p-6 transition hover:border-gold/40">
      <span className="text-xs font-semibold uppercase tracking-widest text-gold">
        {label}
      </span>
      <p className="mt-2 break-words text-sm text-cream/85">{value}</p>
    </a>
  );
}
