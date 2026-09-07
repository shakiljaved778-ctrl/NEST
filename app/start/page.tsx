import type { Metadata } from "next";
import { Suspense } from "react";
import { seo } from "@/data/content";
import StartHeader from "@/components/start/StartHeader";
import Wizard from "@/components/start/Wizard";

export const metadata: Metadata = {
  title: seo.start.title,
  description: seo.start.description,
};

export default function StartPage() {
  return (
    <section className="wrap py-14 sm:py-16">
      <StartHeader />
      {/* min-height reserves the wizard's space so the client-mounted wizard
          doesn't shift the footer (keeps CLS ~0). */}
      <div className="mt-10 min-h-[640px]">
        <Suspense
          fallback={
            <div className="mx-auto flex min-h-[640px] max-w-2xl items-start justify-center pt-20 text-cream/60">
              Loading…
            </div>
          }
        >
          <Wizard />
        </Suspense>
      </div>
    </section>
  );
}
