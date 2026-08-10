# QatarStore.com

A premium **dark-luxury** website for a Doha web design studio. It does two
jobs: showcases a portfolio of website designs, and acts as the primary
client-facing interface where a corporate client can **scope, brief, and
commission** a website project without a single phone call.

Built with **Next.js 15 (App Router)** + **Tailwind CSS**. No CMS, no database —
all editable content lives in one file.

---

## Highlights

- **6 pages**: Home, Work (filterable portfolio), Services & Pricing, Start (the
  multi-step intake wizard), About, Contact — plus dynamic case studies at
  `/work/[slug]`.
- **Client intake wizard** (`/start`): 5 steps, progress bar, per-step
  validation, back navigation, **localStorage draft persistence**, package
  pre-select via `?package=`, on-screen brief summary, email + WhatsApp delivery.
- **Bilingual-ready**: English ships fully; an `AR` toggle flips the whole
  document to **RTL** using a stub Arabic dictionary. Every UI string is
  translatable from `data/i18n.ts`.
- **Dark-luxury design system**: deep navy `#0B1B33`, gold `#C9A24B`, off-white
  `#F5F2EA`, Fraunces + Inter, thin gold rules, subtle grain, restrained
  fade-up + hover-lift motion.
- **WhatsApp-first**: gold floating chat button on every page.
- **SEO**: per-page meta targeting "website design Qatar" / "web design Doha" /
  "موقع الكتروني قطر", JSON-LD `LocalBusiness`, `sitemap.xml`, `robots.txt`,
  auto-generated OG image.
- **Fast**: ~105 kB shared JS, no heavy libraries, CSS-drawn portfolio mockups
  (no stock screenshots). Targets Lighthouse 90+.

## Edit content in one place

Everything you'd want to change lives in:

- **`data/content.ts`** — copy, portfolio items, pricing, packages, add-ons,
  process steps, wizard options, per-page SEO, and all contact details.
- **`data/i18n.ts`** — UI strings (English + Arabic stub).

Nothing user-facing is hard-coded in components.

## Run locally

```bash
npm install
npm run dev        # http://localhost:4200
```

Other scripts:

```bash
npm run build      # production build
npm run start      # serve the production build
npm run typecheck  # tsc --noEmit
```

## Deploy to Vercel (one command)

```bash
npm i -g vercel
vercel --prod
```

Then add your domain and env vars in the Vercel dashboard — see **`SETUP.md`**.
The site deploys and runs **without any API keys**; the brief form falls back to
WhatsApp until `RESEND_API_KEY` is set.

## Project structure

```
app/
  layout.tsx            # fonts, metadata, JSON-LD, nav/footer/WhatsApp shell
  globals.css           # design system, grain, buttons, form controls
  page.tsx              # Home  → components/views/HomeView
  work/page.tsx         # Portfolio (filterable) → WorkView
  work/[slug]/page.tsx  # Case study (SSG per project)
  services/page.tsx     # Services & pricing → ServicesView
  start/page.tsx        # Intake wizard (Suspense) → start/Wizard
  about/page.tsx        # About → AboutView
  contact/page.tsx      # Contact → ContactView
  api/brief/route.ts    # Brief submission (Resend + graceful stub)
  sitemap.ts robots.ts opengraph-image.tsx not-found.tsx
components/
  Navbar · Footer · WhatsAppFab · Reveal · BrowserMockup · PortfolioCard
  LanguageProvider      # EN/AR context + RTL
  start/                # Wizard · StyleTile · StartHeader
  views/                # per-page client views
data/
  content.ts            # ← all editable content
  i18n.ts               # ← UI strings (EN + AR stub)
lib/
  brief.ts              # shared brief formatter (summary/email/WhatsApp)
```

See **`SETUP.md`** for the full go-live checklist.
