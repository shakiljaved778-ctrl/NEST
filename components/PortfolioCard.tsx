import Link from "next/link";
import type { Project } from "@/data/content";
import { industries } from "@/data/content";
import BrowserMockup from "./BrowserMockup";

export default function PortfolioCard({ project }: { project: Project }) {
  const industry = industries.find((i) => i.id === project.industry);
  return (
    <Link
      href={`/work/${project.slug}`}
      className="group block rounded-xl2 border border-white/10 bg-white/[0.03] p-4 transition duration-300 hover:-translate-y-1.5 hover:border-gold/40 hover:bg-white/[0.05]"
    >
      <BrowserMockup theme={project.mockup} />
      <div className="mt-4 flex items-center justify-between gap-3">
        <span className="rounded-full border border-gold/30 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-gold">
          {industry?.label}
        </span>
        {project.isDemo && (
          <span className="text-[10px] uppercase tracking-widest text-cream/40">
            Demo
          </span>
        )}
      </div>
      <h3 className="mt-3 font-display text-lg leading-snug">
        {project.name}
      </h3>
      <p className="text-xs text-cream/55">{project.location}</p>
      <p className="mt-2 text-sm text-cream/75">{project.result}</p>
      <span className="mt-3 inline-block text-sm font-semibold text-gold transition group-hover:translate-x-1">
        View case study →
      </span>
    </Link>
  );
}
