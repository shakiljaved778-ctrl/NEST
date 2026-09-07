import type { Metadata } from "next";
import { seo } from "@/data/content";
import ContactView from "@/components/views/ContactView";

export const metadata: Metadata = {
  title: seo.contact.title,
  description: seo.contact.description,
};

export default function ContactPage() {
  return <ContactView />;
}
