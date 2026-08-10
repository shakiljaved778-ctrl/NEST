import type { Metadata } from "next";
import { seo } from "@/data/content";
import AboutView from "@/components/views/AboutView";

export const metadata: Metadata = {
  title: seo.about.title,
  description: seo.about.description,
};

export default function AboutPage() {
  return <AboutView />;
}
