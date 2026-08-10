# QatarStore.com — Setup & Handover

Everything below is a manual step **you** need to complete before or shortly
after going live. The site builds and runs fully without any of these — they
replace placeholders with your real details and turn on email delivery.

Every placeholder in code is marked with `// TODO:` so you can grep for them:

```bash
grep -rn "TODO:" data/ app/ lib/
```

---

## 1. Business details (edit `data/content.ts` → `site`)

| Field | What to set | Currently |
|-------|-------------|-----------|
| `whatsappNumber` | Your WhatsApp Business number, international format, digits only (e.g. `97455551234`) | `97400000000` placeholder |
| `email` | Inbox that receives project briefs | `hello@qatarstore.com` |
| `phoneDisplay` / `phoneHref` | Public phone number | `+974 0000 0000` |
| `addressLine` | Real street address (used in JSON-LD too) | `West Bay, Doha` |
| `url` | Final production domain | `https://qatarstore.com` |

The WhatsApp number also feeds the floating button on every page and the
brief hand-off, so set it first.

## 2. LocalBusiness schema (edit `app/layout.tsx`)

Update `localBusinessSchema.address.streetAddress` with your real address.
Everything else (city, country, hours, price range) is already wired to Doha /
Qatar / Sun–Thu.

## 3. Email delivery (Resend)

The brief form works with **no key** — it logs the brief and shows the client a
WhatsApp fallback. To receive briefs by email:

1. Create a free account at [resend.com](https://resend.com) and get an API key.
2. Verify your sending domain in Resend (or use `onboarding@resend.dev` for
   testing only).
3. Set these environment variables (locally in `.env.local`, and in Vercel →
   Project → Settings → Environment Variables):

   ```
   RESEND_API_KEY=re_xxxxxxxxxxxx
   BRIEF_TO_EMAIL=you@yourdomain.com
   BRIEF_FROM_EMAIL=QatarStore <hello@yourdomain.com>
   ```

   Logic lives in `app/api/brief/route.ts`. No key = graceful stub, never an error.

## 4. Real portfolio (edit `data/content.ts` → `projects`)

The 6 seeded projects are **demo** (fictional Qatar businesses, CSS mockups).
For each real project:

- Set `isDemo: false`.
- Replace the CSS `BrowserMockup` with a real screenshot: drop the image in
  `public/work/` and swap the `<BrowserMockup />` in
  `components/PortfolioCard.tsx` and `app/work/[slug]/page.tsx` for a
  `next/image` `<Image />`.
- Update `challenge`, `solution`, `result`, `tech`, `delivery`, `before`/`after`.

## 5. Arabic content

English ships fully. Arabic is a working **stub** — nav, buttons and key labels
are translated and the `AR` toggle flips the whole document to RTL. To finish
Arabic, extend the `ar` map in `data/i18n.ts` (same keys as `en`). Rich page
copy in `content.ts` can be given `ar` variants when you're ready.

## 6. Domain & DNS (Vercel)

1. Deploy (see README). Vercel gives you a `*.vercel.app` URL.
2. Vercel → Project → Settings → **Domains** → add `qatarstore.com`.
3. At your registrar, point DNS as Vercel instructs:
   - Apex `qatarstore.com` → `A` record `76.76.21.21`, **or** an `ALIAS`/`ANAME`
     to `cname.vercel-dns.com`.
   - `www` → `CNAME` `cname.vercel-dns.com`.
4. SSL is issued automatically once DNS resolves.

## 7. Map & Google Business

- The contact-page map is a keyless Google Maps embed centred on Doha. To pin
  your exact office, change the `src` query in `components/views/ContactView.tsx`
  to your address or coordinates.
- Set up a **Google Business Profile** for local SEO (part of the Growth package
  you sell — do it for yourself too).

## 8. Favicon / brand assets (optional)

Add `app/icon.png` (any square PNG) and `app/apple-icon.png` for tab and iOS
icons. The social share image is generated automatically at `/opengraph-image`.

---

## Placeholder checklist

- [ ] WhatsApp number
- [ ] Contact email + phone
- [ ] Real street address (content.ts + layout.tsx JSON-LD)
- [ ] Production domain (`site.url`)
- [ ] `RESEND_API_KEY`, `BRIEF_TO_EMAIL`, `BRIEF_FROM_EMAIL`
- [ ] Real portfolio screenshots + copy (`isDemo: false`)
- [ ] Arabic dictionary completion (optional for v1)
- [ ] DNS pointed to Vercel
- [ ] Google Business Profile
