import type { Metadata } from "next";
import { seo } from "@/data/content";
import HomeView from "@/components/views/HomeView";

export const metadata: Metadata = {
  title: seo.home.title,
  description: seo.home.description,
};

export default function HomePage() {
  return <HomeView />;
}
