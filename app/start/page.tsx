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
      <div className="mt-10">
        <Suspense fallback={<div className="mx-auto max-w-2xl text-center text-cream/60">Loading…</div>}>
          <Wizard />
        </Suspense>
      </div>
    </section>
  );
}
