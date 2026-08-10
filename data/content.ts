/**
 * QatarStore.com — single source of truth for all editable content.
 *
 * Edit copy, portfolio items, pricing, and contact details HERE.
 * Nothing user-facing should be hard-coded in components.
 *
 * TODO markers below (// TODO: ...) list every placeholder you must replace.
 * See SETUP.md for the full checklist.
 */

export type Lang = "en" | "ar";

/* ------------------------------------------------------------------ */
/* Site + contact configuration                                        */
/* ------------------------------------------------------------------ */

export const site = {
  name: "QatarStore",
  domain: "qatarstore.com",
  url: "https://qatarstore.com", // TODO: confirm final domain
  // TODO: ADD real WhatsApp number (international format, no +/spaces)
  whatsappNumber: "97400000000",
  whatsappText: "Hi QatarStore, I'd like to discuss a website project.",
  // TODO: ADD the inbox that receives project briefs
  email: "hello@qatarstore.com",
  phoneDisplay: "+974 0000 0000", // TODO: ADD real phone
  phoneHref: "+97400000000",
  addressLine: "West Bay, Doha, Qatar", // TODO: ADD real address for JSON-LD
  serviceArea: "All of Qatar — Doha, Al Wakrah, Al Khor, Lusail",
  businessHours: "Sunday – Thursday · 9:00 – 18:00 (Qatar time)",
  founded: "2024",
} as const;

export function whatsappLink(prefill?: string): string {
  const text = encodeURIComponent(prefill ?? site.whatsappText);
  return `https://wa.me/${site.whatsappNumber}?text=${text}`;
}

/* ------------------------------------------------------------------ */
/* Industries — shared by portfolio filters + intake dropdown          */
/* ------------------------------------------------------------------ */

export const industries = [
  { id: "restaurants", label: "Restaurants & Cafés" },
  { id: "clinics", label: "Clinics & Wellness" },
  { id: "realestate", label: "Real Estate" },
  { id: "retail", label: "Retail & Trading" },
  { id: "professional", label: "Professional Services" },
  { id: "salons", label: "Salons & Beauty" },
] as const;

export type IndustryId = (typeof industries)[number]["id"];

/* ------------------------------------------------------------------ */
/* Portfolio — 6 seeded DEMO projects.                                 */
/* Names are fictional-but-plausible. Swap `isDemo` items for real work.*/
/* Mockup imagery is rendered with CSS (see BrowserMockup); `mockup`    */
/* selects a styled preview theme — no fake stock screenshots.         */
/* ------------------------------------------------------------------ */

export type Project = {
  slug: string;
  isDemo: boolean; // TODO: set false + add real screenshots when swapped
  name: string;
  location: string;
  industry: IndustryId;
  result: string; // one-line outcome for the card
  mockup: MockupTheme;
  challenge: string;
  solution: string;
  tech: string[];
  delivery: string;
  before?: string;
  after?: string;
};

export type MockupTheme =
  | "restaurant"
  | "clinic"
  | "realestate"
  | "retail"
  | "professional"
  | "salon";

export const projects: Project[] = [
  {
    slug: "al-bahr-seafood",
    isDemo: true,
    name: "Al Bahr Seafood Restaurant",
    location: "West Bay, Doha",
    industry: "restaurants",
    result: "Online reservations up 3× in the first month.",
    mockup: "restaurant",
    challenge:
      "Al Bahr relied entirely on walk-ins and phone bookings. Guests couldn't see the menu before arriving, and the kitchen lost tables to no-shows during peak season.",
    solution:
      "A bilingual single-page site with a photo-led menu, one-tap WhatsApp reservations, Google Maps directions, and a table-booking form that confirms instantly. Arabic and English switch with the tap of a button.",
    tech: ["Next.js", "Tailwind CSS", "WhatsApp Business", "Google Maps"],
    delivery: "Delivered in 12 days",
    before: "A single Instagram link with no menu and no way to book.",
    after: "A branded reservations engine that fills tables before guests arrive.",
  },
  {
    slug: "pearl-dental-clinic",
    isDemo: true,
    name: "Pearl Dental Clinic",
    location: "Al Sadd, Doha",
    industry: "clinics",
    result: "40% of new appointments now start online.",
    mockup: "clinic",
    challenge:
      "The clinic's front desk was overwhelmed with appointment calls, and international patients had no way to understand services or pricing before visiting.",
    solution:
      "A calm, trustworthy clinic site with a clear treatments list, dentist profiles, an online booking request, insurance information, and bilingual content that reassures patients from first click to confirmed slot.",
    tech: ["Next.js", "Tailwind CSS", "Booking form", "Google Business"],
    delivery: "Delivered in 18 days",
    before: "A one-page brochure that hadn't been updated in three years.",
    after: "A booking-first clinic site that filters and schedules patients 24/7.",
  },
  {
    slug: "lusail-realty",
    isDemo: true,
    name: "Lusail Realty Group",
    location: "Lusail Marina",
    industry: "realestate",
    result: "Qualified enquiries doubled within six weeks.",
    mockup: "realestate",
    challenge:
      "Listings lived on a slow portal the agency didn't control. There was no branded home for premium properties and no fast way for buyers to enquire.",
    solution:
      "A polished property showcase with filterable listings, full-bleed gallery pages, mortgage-ready enquiry forms, and instant WhatsApp hand-off to the agent handling each unit.",
    tech: ["Next.js", "Tailwind CSS", "Listing data file", "WhatsApp"],
    delivery: "Delivered in 20 days",
    before: "Reliance on third-party portals with generic branding.",
    after: "An owned, high-end listings site that positions Lusail Realty as premium.",
  },
  {
    slug: "gulf-trading-co",
    isDemo: true,
    name: "Gulf Trading & Supplies Co.",
    location: "Industrial Area, Doha",
    industry: "retail",
    result: "Wholesale quote requests grew 60%.",
    mockup: "retail",
    challenge:
      "A respected B2B supplier looked invisible online. Buyers couldn't browse the catalogue or request quotes without a phone call to the office.",
    solution:
      "A catalogue-driven site with product categories, downloadable line cards, a structured quote-request form, and bilingual copy that speaks to both procurement managers and site foremen.",
    tech: ["Next.js", "Tailwind CSS", "Catalogue data file", "Quote form"],
    delivery: "Delivered in 19 days",
    before: "No website — just a printed catalogue and a landline.",
    after: "A 24/7 catalogue that turns browsers into quote requests.",
  },
  {
    slug: "meridian-advisory",
    isDemo: true,
    name: "Meridian Advisory Partners",
    location: "Msheireb, Doha",
    industry: "professional",
    result: "Consultation bookings up 45%.",
    mockup: "professional",
    challenge:
      "A boutique advisory firm's credibility online didn't match the calibre of its clients. The old site felt dated and generic against global competitors.",
    solution:
      "A confident corporate site with clear service lines, partner bios, insight articles, and a discreet consultation-request flow. Restrained design that signals seniority and discretion.",
    tech: ["Next.js", "Tailwind CSS", "Insights section", "Contact routing"],
    delivery: "Delivered in 16 days",
    before: "A template site that looked like everyone else's.",
    after: "A distinctive brand presence that wins the first meeting.",
  },
  {
    slug: "elan-beauty-lounge",
    isDemo: true,
    name: "Élan Beauty Lounge",
    location: "The Pearl, Doha",
    industry: "salons",
    result: "70% of bookings now self-serve online.",
    mockup: "salon",
    challenge:
      "The salon ran its entire calendar over WhatsApp, and staff spent hours confirming appointments instead of serving clients.",
    solution:
      "An elegant salon site with a visual services menu, transparent pricing, an online booking request, a gift-voucher enquiry, and Instagram-ready styling that mirrors the lounge's interior.",
    tech: ["Next.js", "Tailwind CSS", "Booking system", "Instagram feed"],
    delivery: "Delivered in 14 days",
    before: "A WhatsApp-only calendar that ate the team's time.",
    after: "A booking-first salon site that frees the front desk.",
  },
];

/* ------------------------------------------------------------------ */
/* Services & pricing                                                  */
/* ------------------------------------------------------------------ */

export type Package = {
  id: "launch" | "growth" | "enterprise";
  name: string;
  priceQAR: string; // display string
  tagline: string;
  delivery: string;
  features: string[];
  highlighted?: boolean;
};

export const packages: Package[] = [
  {
    id: "launch",
    name: "Launch",
    priceQAR: "QAR 3,500",
    tagline: "Everything a Qatar business needs to look credible online — fast.",
    delivery: "14-day delivery",
    features: [
      "5-page website",
      "Mobile responsive on every device",
      "WhatsApp click-to-chat integration",
      "Google Maps location",
      "Contact form to your inbox",
      "Basic on-page SEO setup",
    ],
  },
  {
    id: "growth",
    name: "Growth",
    priceQAR: "QAR 7,500",
    tagline: "For businesses that want to take bookings and be found in two languages.",
    delivery: "21-day delivery",
    highlighted: true,
    features: [
      "Everything in Launch",
      "Arabic + English bilingual site",
      "Booking or menu system",
      "Google Business Profile setup",
      "Structured SEO for local search",
      "Speed & Core Web Vitals tuning",
    ],
  },
  {
    id: "enterprise",
    name: "Enterprise",
    priceQAR: "QAR 15,000+",
    tagline: "A complete digital presence with commerce, content, and support.",
    delivery: "Custom timeline",
    features: [
      "Everything in Growth",
      "E-commerce or custom features",
      "Professional copywriting",
      "Photography coordination",
      "3 months of priority support",
      "Analytics & conversion tracking",
    ],
  },
];

export const addOns = [
  { name: "Monthly maintenance", price: "QAR 400 / mo" },
  { name: "Extra language", price: "from QAR 1,200" },
  { name: "Logo design", price: "from QAR 1,500" },
  { name: "Hosting management", price: "QAR 300 / mo" },
];

/* ------------------------------------------------------------------ */
/* Process steps (Home)                                                */
/* ------------------------------------------------------------------ */

export const processSteps = [
  {
    n: "01",
    title: "Brief",
    time: "Day 1",
    body: "You complete the online project brief — or we talk on WhatsApp. We confirm scope and price the same day. No meetings required.",
  },
  {
    n: "02",
    title: "Design",
    time: "Days 2–5",
    body: "We design your homepage and key screens in your brand direction. You review and approve in one clean round.",
  },
  {
    n: "03",
    title: "Build",
    time: "Days 6–12",
    body: "We build the full site — bilingual, fast, and mobile-first — wiring in WhatsApp, maps, forms, and SEO.",
  },
  {
    n: "04",
    title: "Launch",
    time: "Day 14",
    body: "We connect your domain, test on real devices, and go live. You get a site you can update, and we stay on call.",
  },
];

/* ------------------------------------------------------------------ */
/* Intake wizard options                                               */
/* ------------------------------------------------------------------ */

export const goalOptions = [
  { id: "found", label: "Get found on Google" },
  { id: "bookings", label: "Take bookings or orders" },
  { id: "professional", label: "Look more professional" },
  { id: "products", label: "Showcase products or services" },
  { id: "bilingual", label: "Bilingual (Arabic + English) presence" },
];

export const styleDirections = [
  {
    id: "minimal",
    name: "Minimal Luxury",
    desc: "Dark, spacious, gold accents. Quiet confidence.",
  },
  {
    id: "bold",
    name: "Bold & Modern",
    desc: "High contrast, big type, vivid energy.",
  },
  {
    id: "warm",
    name: "Warm & Traditional",
    desc: "Earthy tones, heritage feel, Arabic-forward.",
  },
  {
    id: "corporate",
    name: "Clean Corporate",
    desc: "Crisp, structured, trustworthy blue-and-white.",
  },
] as const;

export const timelineOptions = [
  { id: "rush", label: "As soon as possible" },
  { id: "standard", label: "Within a month" },
  { id: "flexible", label: "Flexible — quality first" },
];

export const qatarLocations = [
  "Doha",
  "West Bay",
  "The Pearl",
  "Lusail",
  "Al Wakrah",
  "Al Khor",
  "Al Rayyan",
  "Msheireb",
  "Other",
];

/* ------------------------------------------------------------------ */
/* Rich page copy (English canonical)                                  */
/* ------------------------------------------------------------------ */

export const home = {
  heroKicker: "Doha web design studio",
  heroTitle: "Websites that make Qatar businesses look world-class.",
  heroSub:
    "We design and build premium bilingual websites for Qatar's restaurants, clinics, salons, real estate agencies, trading companies, and professional firms — with fixed pricing and 14-day delivery.",
  trustStrip: [
    "Built in Doha",
    "Arabic + English sites",
    "Delivered in 14 days",
    "Fixed pricing",
  ],
  servicesIntro:
    "Three fixed-price packages. No hourly billing, no surprises — you know the price before we start.",
  finalCtaTitle: "Ready to look world-class?",
  finalCtaSub:
    "Start your project brief online in five minutes, or message us on WhatsApp. We reply within four business hours.",
};

export const servicesPage = {
  kicker: "Services & pricing",
  title: "Fixed prices. Clear scope. No phone tag.",
  sub: "Every package is a fixed price in Qatari Riyals. Pick a starting point — we'll confirm the exact scope from your brief.",
};

export const workPage = {
  kicker: "Selected work",
  title: "Sites we've built for Qatar businesses.",
  sub: "A sample of the studio's work across Qatar's key industries. Filter by sector to see the closest fit to your own.",
};

export const about = {
  kicker: "About the studio",
  title: "A Doha studio building AI-accelerated websites for Qatar business.",
  lead:
    "QatarStore is a founder-led web design studio based in Doha. We pair a finance-and-technology background with modern AI-accelerated build tools to ship premium websites faster than a traditional agency — at a fixed, honest price.",
  paragraphs: [
    "We work exclusively with Qatar businesses. That means bilingual Arabic and English sites, WhatsApp-first contact, Sunday-to-Thursday support, and pricing in Qatari Riyals. No offshore call centre, no vague hourly invoices.",
    "Because we build with AI-accelerated tooling, a site that used to take three months takes two weeks — without cutting corners on design or performance. You get a fast, accessible, search-ready website you can be proud of.",
    "Every project is scoped up front and delivered against a fixed price and a fixed date. If you can brief it, we can build it.",
  ],
  values: [
    { title: "Local presence", body: "Based in Doha, working on Qatar time, in Arabic and English." },
    { title: "Fixed pricing", body: "Prices in QAR, published up front. No hourly surprises." },
    { title: "Fast delivery", body: "Most sites live in 14 days. Enterprise on a clear timeline." },
    { title: "Bilingual by default", body: "Every site is built to work beautifully in both languages." },
  ],
};

export const contactPage = {
  kicker: "Contact",
  title: "Let's talk on WhatsApp.",
  sub: "The fastest way to reach the studio is WhatsApp — we usually reply within a few hours during business days. Prefer email or a form? Those work too.",
};

/* ------------------------------------------------------------------ */
/* SEO metadata per page                                               */
/* ------------------------------------------------------------------ */

export const seo = {
  home: {
    title: "Website Design Qatar | Premium Web Design Doha — QatarStore",
    description:
      "QatarStore designs premium bilingual websites for Qatar businesses. Fixed pricing in QAR, 14-day delivery, Arabic + English. موقع الكتروني قطر.",
  },
  work: {
    title: "Our Work | Website Design Portfolio Qatar — QatarStore",
    description:
      "See websites QatarStore has designed for restaurants, clinics, real estate, retail, and professional firms across Doha and Qatar.",
  },
  services: {
    title: "Web Design Pricing Qatar | Packages from QAR 3,500 — QatarStore",
    description:
      "Fixed-price website packages for Qatar businesses. Launch QAR 3,500, Growth QAR 7,500, Enterprise from QAR 15,000. Bilingual, fast, delivered in days.",
  },
  start: {
    title: "Start Your Project | Website Brief — QatarStore Doha",
    description:
      "Scope and commission your website online in five minutes. Tell us your business, goals, and style — get a fixed quote without a single phone call.",
  },
  about: {
    title: "About | Doha Web Design Studio — QatarStore",
    description:
      "A founder-led Doha studio building AI-accelerated, bilingual websites for Qatar businesses at fixed prices with fast delivery.",
  },
  contact: {
    title: "Contact | Web Design Doha, Qatar — QatarStore",
    description:
      "Reach QatarStore on WhatsApp, phone, or email. Serving all of Qatar — Doha, Al Wakrah, Al Khor, Lusail. Sunday–Thursday.",
  },
};
