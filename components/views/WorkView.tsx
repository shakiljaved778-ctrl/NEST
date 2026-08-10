"use client";

import { useState } from "react";
import { projects, industries, workPage } from "@/data/content";
import { useLang } from "@/components/LanguageProvider";
import Reveal from "@/components/Reveal";
import PortfolioCard from "@/components/PortfolioCard";

export default function WorkView() {
  const { t } = useLang();
  const [active, setActive] = useState<string>("all");
  const filtered =
    active === "all" ? projects : projects.filter((p) => p.industry === active);

  return (
    <section className="wrap py-16 sm:py-20">
      <Reveal>
        <span className="kicker">{workPage.kicker}</span>
        <h1 className="mt-3 font-display text-4xl sm:text-5xl">{workPage.title}</h1>
        <p className="mt-4 max-w-2xl text-cream/75">{workPage.sub}</p>
      </Reveal>

      {/* Filters */}
      <div className="mt-10 flex flex-wrap gap-2">
        <FilterChip
          label={t("filter.all")}
          active={active === "all"}
          onClick={() => setActive("all")}
        />
        {industries.map((ind) => (
          <FilterChip
            key={ind.id}
            label={ind.label}
            active={active === ind.id}
            onClick={() => setActive(ind.id)}
          />
        ))}
      </div>

      {/* Grid */}
      <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map((p, i) => (
          <Reveal key={p.slug} delay={(i % 3) * 70}>
            <PortfolioCard project={p} />
          </Reveal>
        ))}
      </div>

      {filtered.length === 0 && (
        <p className="mt-16 text-center text-cream/60">
          No projects in this category yet — but we'd love to build yours.
        </p>
      )}
    </section>
  );
}

function FilterChip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full border px-4 py-2 text-sm font-medium transition ${
        active
          ? "border-gold bg-gold text-navy-800"
          : "border-white/15 text-cream/75 hover:border-gold/50 hover:text-cream"
      }`}
    >
      {label}
    </button>
  );
}
