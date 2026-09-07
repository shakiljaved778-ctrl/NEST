import type { Metadata } from "next";
import { seo } from "@/data/content";
import ServicesView from "@/components/views/ServicesView";

export const metadata: Metadata = {
  title: seo.services.title,
  description: seo.services.description,
};

export default function ServicesPage() {
  return <ServicesView />;
}
