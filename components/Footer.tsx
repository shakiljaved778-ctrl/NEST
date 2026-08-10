"use client";

import Link from "next/link";
import { site, whatsappLink } from "@/data/content";
import { useLang } from "./LanguageProvider";

export default function Footer() {
  const { t } = useLang();
  const year = new Date().getFullYear();

  return (
    <footer className="relative z-10 mt-24 border-t border-white/10 bg-navy-800/60">
      <div className="wrap grid gap-10 py-14 md:grid-cols-4">
        <div className="md:col-span-2">
          <div className="flex items-center gap-2 font-display text-xl font-semibold">
            <span className="grid h-8 w-8 place-items-center rounded-md border border-gold/50 text-gold">
              Q
            </span>
            Qatar<span className="text-gold">Store</span>
          </div>
          <p className="mt-4 max-w-sm text-sm text-cream/70">
            {t("footer.tagline")} {site.serviceArea}.
          </p>
        </div>

        <div>
          <h4 className="text-xs font-semibold uppercase tracking-widest text-gold">
            {t("footer.explore")}
          </h4>
          <ul className="mt-4 space-y-2 text-sm text-cream/75">
            <li><Link href="/work" className="link-underline">{t("nav.work")}</Link></li>
            <li><Link href="/services" className="link-underline">{t("nav.services")}</Link></li>
            <li><Link href="/about" className="link-underline">{t("nav.about")}</Link></li>
            <li><Link href="/start" className="link-underline">{t("nav.start")}</Link></li>
          </ul>
        </div>

        <div>
          <h4 className="text-xs font-semibold uppercase tracking-widest text-gold">
            {t("footer.contact")}
          </h4>
          <ul className="mt-4 space-y-2 text-sm text-cream/75">
            <li>
              <a href={whatsappLink()} target="_blank" rel="noopener noreferrer" className="link-underline">
                WhatsApp
              </a>
            </li>
            <li><a href={`mailto:${site.email}`} className="link-underline">{site.email}</a></li>
            <li><a href={`tel:${site.phoneHref}`} className="link-underline">{site.phoneDisplay}</a></li>
            <li className="text-cream/55">{site.businessHours}</li>
          </ul>
        </div>
      </div>

      <div className="border-t border-white/10">
        <div className="wrap flex flex-col items-center justify-between gap-2 py-5 text-xs text-cream/50 sm:flex-row">
          <span>© {year} {site.name}. {t("footer.rights")}</span>
          <span>{site.serviceArea}</span>
        </div>
      </div>
    </footer>
  );
}
