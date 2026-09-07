/**
 * UI string dictionary for QatarStore.com.
 *
 * English ships fully. Arabic is a working stub for v1 — key navigation,
 * buttons and labels are translated so the AR toggle flips layout to RTL
 * without breaking. Extend the `ar` map as real Arabic copy is finalised.
 *
 * All UI strings are keyed here so the whole interface is translatable
 * from a single place. Rich page content lives in content.ts.
 */

import type { Lang } from "./content";

export type StringKey = keyof typeof en;

const en = {
  // nav
  "nav.home": "Home",
  "nav.work": "Work",
  "nav.services": "Services",
  "nav.about": "About",
  "nav.contact": "Contact",
  "nav.start": "Start Your Project",
  "nav.lang": "AR",
  "nav.langFull": "العربية",

  // shared CTAs
  "cta.start": "Start Your Project",
  "cta.seeWork": "See Our Work",
  "cta.whatsapp": "Chat on WhatsApp",
  "cta.viewCase": "View case study",
  "cta.backToWork": "Back to all work",
  "cta.next": "Continue",
  "cta.back": "Back",
  "cta.submit": "Send my brief",
  "cta.startOver": "Start a new brief",

  // filters
  "filter.all": "All industries",

  // wizard
  "wizard.title": "Start your project",
  "wizard.sub": "Five short steps. We reply within four business hours.",
  "wizard.step": "Step",
  "wizard.of": "of",
  "wizard.saved": "Draft saved",
  "step1.title": "Your business",
  "step2.title": "Your goals",
  "step3.title": "Your style",
  "step4.title": "Package & budget",
  "step5.title": "Your details",
  "field.businessName": "Business name",
  "field.industry": "Industry",
  "field.location": "Location in Qatar",
  "field.hasWebsite": "Do you have a website?",
  "field.websiteUrl": "Current website URL",
  "field.yes": "Yes",
  "field.no": "No",
  "field.goals": "What do you want your website to do?",
  "field.goalsOther": "Anything else? (optional)",
  "field.timeline": "How soon do you need it?",
  "field.name": "Your name",
  "field.role": "Your role",
  "field.phone": "Phone",
  "field.email": "Email",
  "field.contactMethod": "Preferred contact method",
  "method.whatsapp": "WhatsApp",
  "method.phone": "Phone call",
  "method.email": "Email",

  // brief summary
  "brief.title": "Your project brief",
  "brief.confirmTitle": "Brief received — thank you.",
  "brief.confirmSub": "We reply within 4 business hours.",
  "brief.next": "What happens next",
  "brief.next1": "We review your brief and confirm scope and price.",
  "brief.next2": "You approve — no meeting needed unless you want one.",
  "brief.next3": "We design, build, and launch on a fixed timeline.",
  "brief.whatsappNudge": "Want a faster reply? Send it straight to us on WhatsApp.",

  // footer
  "footer.tagline": "Premium websites for Qatar business.",
  "footer.rights": "All rights reserved.",
  "footer.explore": "Explore",
  "footer.contact": "Contact",
} as const;

const ar: Partial<Record<StringKey, string>> = {
  "nav.home": "الرئيسية",
  "nav.work": "أعمالنا",
  "nav.services": "الخدمات",
  "nav.about": "من نحن",
  "nav.contact": "اتصل بنا",
  "nav.start": "ابدأ مشروعك",
  "nav.lang": "EN",
  "nav.langFull": "English",

  "cta.start": "ابدأ مشروعك",
  "cta.seeWork": "شاهد أعمالنا",
  "cta.whatsapp": "تواصل عبر واتساب",
  "cta.viewCase": "عرض الحالة",
  "cta.backToWork": "العودة إلى الأعمال",
  "cta.next": "متابعة",
  "cta.back": "رجوع",
  "cta.submit": "أرسل طلبي",
  "cta.startOver": "ابدأ طلباً جديداً",

  "filter.all": "كل المجالات",

  "wizard.title": "ابدأ مشروعك",
  "wizard.sub": "خمس خطوات قصيرة. نرد خلال أربع ساعات عمل.",
  "wizard.step": "خطوة",
  "wizard.of": "من",
  "wizard.saved": "تم حفظ المسودة",

  "footer.tagline": "مواقع إلكترونية متميزة لأعمال قطر.",
  "footer.rights": "جميع الحقوق محفوظة.",
  "footer.explore": "استكشف",
  "footer.contact": "اتصل",
};

export const dictionaries: Record<Lang, Partial<Record<StringKey, string>>> = {
  en,
  ar,
};

export function translate(lang: Lang, key: StringKey): string {
  return dictionaries[lang][key] ?? en[key];
}
