"use client";

import { whatsappLink } from "@/data/content";
import { useLang } from "./LanguageProvider";

function WhatsAppIcon() {
  return (
    <svg viewBox="0 0 32 32" className="h-7 w-7" fill="currentColor" aria-hidden>
      <path d="M16.003 3.2c-7.06 0-12.8 5.74-12.8 12.8 0 2.26.6 4.46 1.73 6.4L3.2 28.8l6.57-1.72a12.74 12.74 0 0 0 6.23 1.6h.005c7.06 0 12.8-5.74 12.8-12.8s-5.74-12.8-12.8-12.8zm0 23.4h-.004a10.6 10.6 0 0 1-5.4-1.48l-.39-.23-3.9 1.02 1.04-3.8-.25-.4a10.57 10.57 0 0 1-1.62-5.62c0-5.86 4.77-10.63 10.63-10.63 2.84 0 5.5 1.1 7.5 3.11a10.55 10.55 0 0 1 3.11 7.52c0 5.86-4.77 10.63-10.62 10.63zm5.83-7.96c-.32-.16-1.89-.93-2.18-1.04-.29-.11-.5-.16-.71.16-.21.32-.82 1.04-1 1.25-.18.21-.37.24-.69.08-.32-.16-1.35-.5-2.57-1.58-.95-.85-1.59-1.89-1.78-2.21-.18-.32-.02-.49.14-.65.14-.14.32-.37.48-.55.16-.18.21-.32.32-.53.11-.21.05-.4-.03-.56-.08-.16-.71-1.72-.98-2.35-.26-.62-.52-.54-.71-.55l-.61-.01c-.21 0-.56.08-.85.4-.29.32-1.11 1.09-1.11 2.64 0 1.56 1.14 3.06 1.29 3.27.16.21 2.24 3.42 5.42 4.79.76.33 1.35.52 1.81.67.76.24 1.45.21 2 .13.61-.09 1.89-.77 2.16-1.52.27-.75.27-1.38.19-1.52-.08-.13-.29-.21-.61-.37z" />
    </svg>
  );
}

export default function WhatsAppFab() {
  const { t, dir } = useLang();
  return (
    <a
      href={whatsappLink()}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={t("cta.whatsapp")}
      className={`fixed bottom-5 z-50 flex items-center gap-2 rounded-full bg-gold px-4 py-3 font-semibold text-navy-800 shadow-lift transition hover:bg-gold-light hover:-translate-y-0.5 ${
        dir === "rtl" ? "left-5" : "right-5"
      }`}
    >
      <WhatsAppIcon />
      <span className="hidden text-sm sm:inline">{t("cta.whatsapp")}</span>
    </a>
  );
}
