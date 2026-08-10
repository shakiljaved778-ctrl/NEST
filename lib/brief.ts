/**
 * Shared project-brief formatter. Turns wizard form state into a clean,
 * human-readable summary — reused on-screen, in the email body, and in the
 * WhatsApp fallback so all three always match.
 */

import {
  industries,
  goalOptions,
  styleDirections,
  packages,
  timelineOptions,
} from "@/data/content";

export type BriefData = {
  businessName: string;
  industry: string;
  location: string;
  hasWebsite: "yes" | "no" | "";
  websiteUrl: string;
  goals: string[];
  goalsOther: string;
  style: string;
  package: string;
  timeline: string;
  name: string;
  role: string;
  phone: string;
  email: string;
  contactMethod: string;
};

export const emptyBrief: BriefData = {
  businessName: "",
  industry: "",
  location: "",
  hasWebsite: "",
  websiteUrl: "",
  goals: [],
  goalsOther: "",
  style: "",
  package: "",
  timeline: "",
  name: "",
  role: "",
  phone: "+974 ",
  email: "",
  contactMethod: "whatsapp",
};

const label = (list: readonly { id: string; label?: string; name?: string }[], id: string) => {
  const found = list.find((x) => x.id === id);
  return found?.label ?? found?.name ?? id;
};

export function formatBrief(d: BriefData): string {
  const goals = d.goals.map((g) => label(goalOptions, g));
  if (d.goalsOther.trim()) goals.push(d.goalsOther.trim());

  const lines = [
    `PROJECT BRIEF — ${d.businessName || "Untitled"}`,
    ``,
    `BUSINESS`,
    `• Name: ${d.businessName || "—"}`,
    `• Industry: ${label(industries, d.industry)}`,
    `• Location: ${d.location || "—"}`,
    `• Existing website: ${d.hasWebsite === "yes" ? d.websiteUrl || "Yes" : "No"}`,
    ``,
    `GOALS`,
    ...(goals.length ? goals.map((g) => `• ${g}`) : ["• —"]),
    ``,
    `STYLE DIRECTION`,
    `• ${label(styleDirections, d.style)}`,
    ``,
    `PACKAGE & TIMELINE`,
    `• Package: ${label(packages, d.package)}`,
    `• Timeline: ${label(timelineOptions, d.timeline)}`,
    ``,
    `CONTACT`,
    `• Name: ${d.name || "—"}`,
    `• Role: ${d.role || "—"}`,
    `• Phone: ${d.phone || "—"}`,
    `• Email: ${d.email || "—"}`,
    `• Preferred contact: ${d.contactMethod}`,
  ];
  return lines.join("\n");
}
