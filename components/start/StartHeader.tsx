"use client";

import { useLang } from "@/components/LanguageProvider";

export default function StartHeader() {
  const { t } = useLang();
  return (
    <div className="mx-auto max-w-2xl text-center">
      <span className="kicker">{t("nav.start")}</span>
      <h1 className="mt-3 font-display text-4xl sm:text-5xl">{t("wizard.title")}</h1>
      <p className="mt-3 text-cream/70">{t("wizard.sub")}</p>
    </div>
  );
}
