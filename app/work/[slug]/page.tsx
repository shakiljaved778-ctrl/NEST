import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { projects, industries, site } from "@/data/content";
import BrowserMockup from "@/components/BrowserMockup";
import CaseStudyCta from "@/components/views/CaseStudyCta";

export function generateStaticParams() {
  return projects.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const project = projects.find((p) => p.slug === slug);
  if (!project) return { title: "Case study — QatarStore" };
  return {
    title: `${project.name} — Website Design Case Study | QatarStore`,
    description: `${project.result} How QatarStore designed and built a website for ${project.name}, ${project.location}.`,
  };
}

export default async function CaseStudyPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const project = projects.find((p) => p.slug === slug);
  if (!project) notFound();

  const industry = industries.find((i) => i.id === project.industry);

  return (
    <article className="wrap py-16 sm:py-20">
      <Link href="/work" className="text-sm text-gold link-underline">
        ← Back to all work
      </Link>

      <header className="mt-6">
        <span className="rounded-full border border-gold/30 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-gold">
          {industry?.label}
        </span>
        <h1 className="mt-4 font-display text-4xl sm:text-5xl">{project.name}</h1>
        <p className="mt-2 text-cream/60">{project.location}</p>
        <p className="mt-5 max-w-2xl font-display text-xl text-gold">
          {project.result}
        </p>
        {project.isDemo && (
          <p className="mt-3 text-xs uppercase tracking-widest text-cream/40">
            Demo project — replace with real screenshots (see SETUP.md)
          </p>
        )}
      </header>

      <div className="mt-10">
        <BrowserMockup theme={project.mockup} className="mx-auto max-w-3xl" />
      </div>

      <div className="mt-14 grid gap-10 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-10">
          <Block title="The challenge" body={project.challenge} />
          <Block title="Our solution" body={project.solution} />
          {(project.before || project.after) && (
            <div>
              <h2 className="font-display text-2xl">Before & after</h2>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <div className="panel p-5">
                  <span className="text-xs font-semibold uppercase tracking-widest text-cream/50">
                    Before
                  </span>
                  <p className="mt-2 text-sm text-cream/75">{project.before}</p>
                </div>
                <div className="panel border-gold/30 bg-gold/[0.05] p-5">
                  <span className="text-xs font-semibold uppercase tracking-widest text-gold">
                    After
                  </span>
                  <p className="mt-2 text-sm text-cream/80">{project.after}</p>
                </div>
              </div>
            </div>
          )}
        </div>

        <aside className="space-y-6">
          <div className="panel p-6">
            <h3 className="font-display text-lg">Project facts</h3>
            <dl className="mt-4 space-y-4 text-sm">
              <div>
                <dt className="text-cream/50">Delivery time</dt>
                <dd className="mt-0.5 text-cream">{project.delivery}</dd>
              </div>
              <div>
                <dt className="text-cream/50">Industry</dt>
                <dd className="mt-0.5 text-cream">{industry?.label}</dd>
              </div>
              <div>
                <dt className="text-cream/50">Built with</dt>
                <dd className="mt-1 flex flex-wrap gap-1.5">
                  {project.tech.map((tech) => (
                    <span
                      key={tech}
                      className="rounded-full border border-white/15 px-2.5 py-0.5 text-xs text-cream/75"
                    >
                      {tech}
                    </span>
                  ))}
                </dd>
              </div>
            </dl>
          </div>
          <CaseStudyCta projectName={project.name} />
        </aside>
      </div>
    </article>
  );
}

function Block({ title, body }: { title: string; body: string }) {
  return (
    <div>
      <h2 className="font-display text-2xl">{title}</h2>
      <p className="mt-3 leading-relaxed text-cream/75">{body}</p>
    </div>
  );
}
