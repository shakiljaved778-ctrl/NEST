import type { Metadata } from "next";
import { seo } from "@/data/content";
import WorkView from "@/components/views/WorkView";

export const metadata: Metadata = {
  title: seo.work.title,
  description: seo.work.description,
};

export default function WorkPage() {
  return <WorkView />;
}
