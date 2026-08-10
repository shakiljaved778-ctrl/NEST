"use client";

import Link from "next/link";
import { whatsappLink } from "@/data/content";
import { useLang } from "@/components/LanguageProvider";

export default function CaseStudyCta({ projectName }: { projectName: string }) {
  const { t } = useLang();
  return (
    <div className="panel border-gold/25 bg-gold/[0.05] p-6 text-center">
      <p className="font-display text-lg">Want a site like this?</p>
      <p className="mt-2 text-sm text-cream/70">
        Start your brief in five minutes — fixed price, fast delivery.
      </p>
      <Link href="/start" className="btn-gold mt-4 w-full">
        {t("cta.start")}
      </Link>
      <a
        href={whatsappLink(`Hi, I liked the ${projectName} project. Can we talk?`)}
        target="_blank"
        rel="noopener noreferrer"
        className="btn-ghost mt-2 w-full"
      >
        {t("cta.whatsapp")}
      </a>
    </div>
  );
}
