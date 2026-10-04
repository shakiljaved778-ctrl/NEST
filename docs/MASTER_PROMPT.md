# AlSouq master prompt

You are the lead engineer building **AlSouq**, a bilingual multi-vendor marketplace website for Qatar. This whole message is the project specification. It overrides your defaults.

## Do this first

1. Save this entire message, word for word, as `docs/MASTER_PROMPT.md` in the current repo. Create the `docs` folder if needed.
2. Summarise the spec back to me in under 20 lines so I can confirm you understood it.
3. List anything in it that is ambiguous, contradictory, or that you would do differently, with your reason.
4. Check the current official docs for Next.js, Prisma, Better Auth, next-intl and MyFatoorah. Tell me if any stack choice here is outdated.
5. Propose the Phase 0 task list and wait.

Do not write application code until I reply `go`.

## Short commands I will use

| I type | You do |
| --- | --- |
| `go` | Start the phase you just proposed. |
| `next` | Read `CLAUDE.md`, `docs/PROGRESS.md` and the next phase below. Create branch `phase-N-short-name` from an up-to-date `main`. In plan mode, give me the task list in build order, schema changes, new environment variables, what you need from me, and the risks. Wait for `go`. |
| `close` | Run lint, type-check, unit tests and build, and fix failures. Show evidence for each acceptance criterion of the current phase. Update `docs/PROGRESS.md` and `docs/DECISIONS.md`. Open a pull request with summary, how to test, new env vars, migrations, and screenshots in English and Arabic. Tell me exactly what to click on the preview to verify. |
| `review` | Review the current branch as a strict senior engineer who did not write it: authorisation on every action and route, vendor data isolation, money maths, missing translations, RTL breaks, missing indexes, untested branches. Report by severity, fix high and medium, re-run CI. |
| `status` | Tell me in ten lines which phase we are in, what is finished, what is half done, and the next three tasks. Change nothing. |
| `bug: ...` | Reproduce with a failing test, explain the root cause in two sentences, fix it, keep the test, and check for the same mistake elsewhere. |

## Working rules

1. Start each session by reading `CLAUDE.md`, `docs/PROGRESS.md` and the current phase in `docs/MASTER_PROMPT.md`.
2. Do only the current phase. Park later ideas in `docs/PROGRESS.md` under Backlog.
3. Use plan mode for anything touching the database schema or payments.
4. When you need a credential, a dashboard setting or a business decision, stop and ask me. Give exact click-by-click steps. I am not an engineer.
5. Never commit secrets. Never use live payment keys. Never run destructive database commands without my explicit approval.
6. Record every non-obvious choice in `docs/DECISIONS.md` with the date and the reason.
7. A phase is finished only when its acceptance criteria pass, CI is green, the preview deployment works in both languages, and `docs/PROGRESS.md` is updated.
8. If something in this spec is wrong or outdated, say so and propose the change. Do not work around it quietly.

---

# Part A: Product and architecture

## A1. Locked decisions

| Area | Decision |
| --- | --- |
| Brand | AlSouq (Arabic: السوق) |
| Product | Multi-vendor marketplace with three parties: buyers, vendors, platform admin |
| Surface | Responsive website only. Keep domain logic outside the web app so an Expo React Native app can be added later as `apps/mobile` |
| Market | Qatar first. Currency QAR. Phone numbers +974. Addresses use Zone, Street, Building |
| Languages | English and Arabic with full right-to-left layout |
| Payments | MyFatoorah only, covering Qatar debit cards, Visa, Mastercard, Amex and wallets, including foreign-issued cards. The payment layer stays provider-neutral so a second gateway can be added later |
| Database | PostgreSQL |
| Source | The GitHub repository `alsouq` already exists. Work in the existing clone. Do not create another repository. If it already holds files, list them and ask before changing or removing anything |
| Hosting | Vercel |

## A2. Stack

Install the latest stable version of each item. Read the official docs before using any version-specific API. Do not rely on memory for syntax.

- **Monorepo:** Turborepo with pnpm workspaces.
- **Web:** Next.js App Router, TypeScript strict mode, Server Components by default, Server Actions for mutations, route handlers for webhooks and cron.
- **UI:** Tailwind CSS with shadcn/ui. Use logical properties (`ms-`, `me-`, `ps-`, `pe-`, `start`, `end`) everywhere so RTL needs no overrides.
- **Internationalisation:** next-intl with locale-prefixed routes `/en` and `/ar`.
- **Database:** Postgres on Neon through the Vercel integration. Prisma for schema and migrations. Pooled connection string at runtime, direct string for migrations.
- **Auth:** Better Auth with email and password, email verification, Google sign-in, database sessions.
- **Files:** Vercel Blob for product images and vendor documents. `next/image` for delivery.
- **Email:** Resend with React Email templates in both languages.
- **Validation and forms:** Zod schemas shared by client and server. React Hook Form.
- **Rate limiting:** Upstash Redis.
- **Search:** Postgres full-text search plus `pg_trgm` for typo tolerance and Arabic matching.
- **Quality:** Vitest, Playwright, ESLint, Prettier, GitHub Actions.
- **Observability:** Sentry for errors, Vercel Analytics for traffic.

## A3. Repository layout

```text
alsouq/
  apps/
    web/                          Next.js app
      app/[locale]/(shop)/        home, category, search, product, vendor storefront, cart, checkout
      app/[locale]/(account)/     buyer orders, addresses, wishlist, returns
      app/[locale]/vendor/        vendor dashboard
      app/[locale]/admin/         platform admin console
      app/api/webhooks/myfatoorah/route.ts
      app/api/cron/               reconciliation and payout jobs
      messages/en.json
      messages/ar.json
  packages/
    db/                           Prisma schema, migrations, seed, typed client
    core/                         pricing, commission, order state machine, ledger (pure functions)
    payments/                     PaymentProvider interface, MyFatoorah adapter, fake provider for tests
    emails/                       React Email templates
    config/                       shared tsconfig, ESLint, Tailwind preset
  docs/
    MASTER_PROMPT.md  DECISIONS.md  PROGRESS.md  RUNBOOK.md
  .github/workflows/ci.yml
  CLAUDE.md
  .env.example
```

## A4. Architecture rules

- Money is stored as integer minor units (QAR x 100) with a currency code. No floats anywhere in pricing, commission or refunds.
- All totals, shipping, discounts and commission are computed on the server in `packages/core`. The client never sends an amount that is trusted.
- Every vendor-scoped read and write goes through one data-access layer that takes `vendorId` from the session, never from request input.
- Authorisation is checked inside every Server Action and route handler. Middleware is for locale and redirects only.
- Order and payment status change only through state-machine functions that reject illegal transitions.
- Payment webhooks are the source of truth for payment status. Handlers verify signatures and are idempotent.
- Order numbers are human-readable, for example `AS-2026-000123`. Primary keys are cuid or uuid.
- Timestamps are stored in UTC and displayed in Asia/Qatar time.
- Products, vendors and users are soft-deleted. Admin and money actions write to an audit log.

## A5. Environment variables

Create `.env.example` with these names and no values. Real values go in Vercel, set separately for Development, Preview and Production.

```text
NEXT_PUBLIC_APP_URL=
DATABASE_URL=
DATABASE_URL_UNPOOLED=
BETTER_AUTH_SECRET=
BETTER_AUTH_URL=
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
MYFATOORAH_API_KEY=
MYFATOORAH_BASE_URL=
MYFATOORAH_WEBHOOK_SECRET=
MYFATOORAH_SPLIT_ENABLED=
BLOB_READ_WRITE_TOKEN=
RESEND_API_KEY=
EMAIL_FROM=
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=
SENTRY_DSN=
CRON_SECRET=
```

## A6. Roles

| Role | Can do |
| --- | --- |
| Guest | Browse, search, build a cart, check out with an email address |
| Buyer | Everything a guest can, plus saved addresses, order history, wishlist, reviews, returns |
| Vendor owner | Manage one store: products, stock, orders, shipping rates, staff, payout details, statements |
| Vendor staff | Products and orders for their store. No payout details, no staff management |
| Admin | Approve vendors, moderate catalogue, set commission, handle refunds and payouts, view reports |

A user can be a buyer and a vendor member at the same time. Roles are stored in the database and checked on the server.

## A7. Data model

Design the Prisma schema around these entities. Add indexes for every foreign key and every filter used in listings. Bilingual text uses paired columns (`nameEn`, `nameAr`) with fallback to English when Arabic is empty.

| Group | Entities | Notes |
| --- | --- | --- |
| Identity | User, Session, Account, Address | Address has zone, street, building, unit, area, city, phone, optional map pin |
| Vendors | Vendor, VendorMember, VendorDocument, VendorBankAccount, ShippingRate | Vendor status: applied, approved, suspended, rejected. Stores the gateway supplier code once created |
| Catalogue | Category (tree), Product, ProductVariant, ProductImage, Attribute, AttributeValue | Product status: draft, pending review, live, rejected, archived. Variant holds SKU, price, compare-at price, stock |
| Shopping | Cart, CartItem, Wishlist, Coupon, CouponRedemption | Guest carts keyed by a signed cookie and merged on sign-in |
| Orders | Order, VendorOrder, OrderItem, Shipment, ReturnRequest | One Order per checkout, one VendorOrder per vendor inside it. Items snapshot name, price and commission rate at purchase time |
| Payments | Payment, PaymentEvent, Refund | Payment records provider, provider reference, amount, status, method, card issuing country. PaymentEvent stores every webhook with a unique provider event id |
| Money | CommissionRule, LedgerEntry, Payout, PayoutItem | Double-entry ledger per vendor. Commission rule precedence: vendor, then category, then global |
| Trust | Review, ReviewReply, Report | Reviews only from buyers with a delivered order for that product |
| Platform | Banner, Page, Notification, AuditLog, Setting | Settings hold tax rate, default commission, return window, payout schedule |

## A8. Status flows

```text
Order:        PENDING_PAYMENT -> PAID -> PARTIALLY_FULFILLED -> FULFILLED -> COMPLETED
              PENDING_PAYMENT -> PAYMENT_FAILED | EXPIRED
              PAID -> CANCELLED (before any shipment) -> REFUNDED

VendorOrder:  NEW -> ACCEPTED -> PACKED -> SHIPPED -> DELIVERED -> COMPLETED
              NEW | ACCEPTED -> CANCELLED
              DELIVERED -> RETURN_REQUESTED -> RETURN_APPROVED -> RETURNED -> REFUNDED

Payment:      INITIATED -> PENDING -> SUCCEEDED | FAILED | EXPIRED
              SUCCEEDED -> PARTIALLY_REFUNDED | REFUNDED

Payout:       SCHEDULED -> PROCESSING -> PAID | FAILED
```

Stock is reserved when payment starts and released if the payment fails or expires after 30 minutes. A vendor's earnings become payable only when the VendorOrder is COMPLETED, which happens when the return window closes.

## A9. Buyer features

- Home page with banners, featured categories, featured vendors, new arrivals and deals.
- Category pages with filters for price, brand, attributes, vendor, rating and availability, plus sorting and pagination.
- Search with autocomplete that matches English and Arabic text and tolerates typos.
- Product page with gallery, variant picker, stock state, delivery estimate, vendor card, reviews and related products.
- Vendor storefront page with logo, description, rating and that vendor's catalogue.
- Cart grouped by vendor, with a shipping line per vendor and coupon entry.
- Checkout in three steps: address, delivery per vendor, payment method. Guest checkout allowed with email and phone.
- Order confirmation page and email. Order tracking page showing each VendorOrder separately.
- Account area: orders, addresses, wishlist, reviews, return requests, profile, language preference.

## A10. Vendor features

- Application form: store name in both languages, commercial registration number and document upload, contact person, bank account (IBAN), categories they want to sell in.
- Dashboard home: today's orders, pending actions, sales for 7 and 30 days, low-stock list.
- Product management: create and edit with variants, images, both languages, attributes. New products go to pending review unless the vendor is marked trusted.
- Bulk upload by CSV with a downloadable template and a row-by-row error report.
- Inventory screen with inline stock editing and low-stock threshold.
- Order management: accept, print packing slip, mark packed, mark shipped with carrier and tracking number, mark delivered.
- Returns: approve or reject with reason, confirm item received.
- Shipping settings: flat rate, free-shipping threshold, delivery time estimate.
- Earnings: balance, pending amount, statement by date range, payout history, CSV export.
- Store settings and staff invitations.

## A11. Admin features

- Vendor queue: review applications and documents, approve, reject with reason, suspend.
- Catalogue moderation queue for pending products. Category and attribute management.
- Commission rules: global default, per category, per vendor override.
- Order oversight across all vendors: cancel, refund fully or partly, add internal notes.
- Payments screen: every payment and webhook event, with a manual re-check button that queries the gateway.
- Payouts: review the scheduled batch, mark as paid or export a bank file, see failures.
- Coupons, home page banners, static pages (about, terms, privacy, returns policy) in both languages.
- Reports: gross merchandise value, commission earned, orders, top vendors, top products, refund rate, international sales. Date range filter and CSV export.
- User management and audit log viewer.

---

# Part B: Payments, commission, payouts

No card data ever touches AlSouq servers. MyFatoorah's hosted page or embedded fields collect it. Build against the sandbox only. I add live keys in Vercel at launch.

**Before coding Phase 7**, open the current MyFatoorah API documentation and write `docs/PAYMENTS.md` covering: the exact endpoints and API version you will use, the request and response fields you depend on, webhook event types, how signatures are verified, sandbox test cards, and how the multi-vendor split payload is built from an Order. List every assumption in this Part that the docs contradict. I review that file before you implement.

## B1. Provider abstraction

All payment code lives in `packages/payments` behind one interface. The web app never calls a gateway SDK directly.

```ts
interface PaymentProvider {
  id: 'myfatoorah';
  createPayment(input: CreatePaymentInput): Promise<{ providerRef: string; redirectUrl: string }>;
  getStatus(providerRef: string): Promise<ProviderPaymentStatus>;
  refund(input: RefundInput): Promise<{ providerRefundRef: string }>;
  verifyWebhook(rawBody: string, headers: Headers): Promise<VerifiedEvent>;
}
```

`CreatePaymentInput` carries the order id, amount in minor units, currency, customer details, locale, return URLs and the per-vendor split. Adding a second gateway later must need only a new adapter, a webhook route and a Settings toggle, with no change to checkout or order code.

## B2. Payment methods at checkout

| Buyer | Methods shown |
| --- | --- |
| Qatar buyer | Qatar debit cards, Visa, Mastercard, Apple Pay, Google Pay |
| International buyer | Visa, Mastercard, Amex, Apple Pay, Google Pay |
| Any method not active on the account, or keys missing | Hidden at checkout. Never fail silently |

- Build the method list from what the gateway returns for the account at checkout time. Do not hard-code which methods exist.
- All charges are in QAR. The buyer's bank handles conversion. For buyers whose address is outside Qatar, show a short note at checkout that the charge is in Qatari riyals.
- Record the method used and the card's issuing country on the Payment row when the gateway returns them.

## B3. MyFatoorah adapter

Use the newest API version the docs recommend. Do not invent field names.

- Create the payment with the gateway-integration flow: list available methods, then execute the payment and redirect the buyer to the returned payment URL. Pass the buyer's language so the hosted page matches the site locale.
- On return to the callback URL, call the payment-status endpoint from the server. Never trust query parameters.
- Register one webhook endpoint. Verify the signature with the webhook secret on the raw request body. Handle transaction status, refund status, supplier status and balance transfer events.
- Multi-vendor: when an admin approves a vendor, create a supplier through the supplier API and store the supplier code on the Vendor. At payment creation, send one supplier entry per VendorOrder with that vendor's share after commission.
- Refunds on split payments use the supplier refund endpoint and state how much each supplier and the platform give back.
- If Multi-Vendor is not enabled on the account, fall back to a single unsplit invoice and record the split in the internal ledger only. Controlled by `MYFATOORAH_SPLIT_ENABLED`.

## B4. Webhook and reconciliation rules

1. Read the raw body, verify the signature, reject with 400 if invalid.
2. Insert a PaymentEvent row keyed by the provider event id. If the insert conflicts, return 200 and stop.
3. Inside one database transaction: update Payment, move Order through the state machine, confirm stock, create VendorOrders and ledger entries.
4. Send emails and notifications after the transaction commits.
5. A cron job every 10 minutes re-checks payments stuck in PENDING for more than 15 minutes by calling `getStatus`, and expires those older than 30 minutes.

## B5. Commission and ledger

- Commission is a percentage of the item subtotal after vendor-funded discounts, before shipping. The rate is resolved at checkout and snapshotted on each OrderItem.
- Platform-funded coupons reduce the platform's commission, not the vendor's earnings. Vendor-funded coupons reduce the vendor's earnings.
- Shipping charged to the buyer belongs to the vendor in full.
- Every money movement writes balanced ledger entries. Accounts per vendor: pending, payable, paid. Platform accounts: commission revenue, gateway fees, refunds.
- Earnings sit in pending until the VendorOrder is COMPLETED, then move to payable.

## B6. Payouts

- A weekly cron job builds a payout batch from each vendor's payable balance above a minimum threshold set in Settings.
- For payments split by MyFatoorah, the gateway deposits to the supplier directly. The ledger mirrors it and the batch excludes those amounts.
- For unsplit MyFatoorah payments, the batch produces a bank-transfer file for the admin, who marks each payout paid with a reference.
- Vendors see every payout with its line items and can download a statement.

## B7. Refunds and disputes

- Refunds are started by an admin, or automatically when a return is confirmed received. Full and partial amounts are supported per VendorOrder.
- A refund reverses the vendor's earnings and the platform's commission in proportion, through ledger entries. If the vendor has already been paid, the amount becomes a negative balance netted from the next payout.
- A chargeback or dispute reported by the gateway freezes the related vendor earnings and raises an admin task.

---

# Part C: Language, design, security, testing, delivery

## C1. English and Arabic

- Routes are `/en/...` and `/ar/...`. Detect the locale from the saved preference, then the browser, defaulting to English. Set `lang` and `dir` on the `html` element.
- No hard-coded user-facing strings. Every string comes from `messages/en.json` and `messages/ar.json`. CI fails if a key exists in one file and not the other.
- Arabic is written as proper Arabic copy, not transliteration. Flag any string you are unsure about in `docs/DECISIONS.md` for human review.
- Use an Arabic-capable typeface pair loaded with `next/font`, for example Inter for Latin and IBM Plex Sans Arabic for Arabic.
- Mirror directional icons (arrows, chevrons, breadcrumbs) in RTL. Do not mirror logos, product images or media controls.
- Prices use `Intl.NumberFormat` and show Western digits in both locales, formatted as `QAR 1,250.00` in English and with the Arabic currency label in Arabic.
- Emails, PDFs and gateway pages follow the buyer's saved locale.
- SEO: localised titles and descriptions, `hreflang` alternates, one sitemap per locale, Product structured data.

## C2. Design direction

- Clean, modern marketplace look with a warm accent that suits the souq name. Choose one professional palette, define it as CSS variables, and record it in `docs/DECISIONS.md`.
- Mobile first. Bottom-reachable primary actions, sticky add-to-cart on product pages, large tap targets.
- Build a small component library first (button, input, select, card, badge, dialog, sheet, table, toast, skeleton, empty state) and reuse it across shop, vendor and admin.

## C3. Security

- Server-side authorisation on every action. Vendor data isolated by `vendorId` from the session. Write tests that prove vendor A cannot read or change vendor B's data.
- Zod validation on every input. Reject unknown fields.
- Rate limit sign-in, sign-up, password reset, checkout creation, search autocomplete and review posting.
- Passwords and sessions handled only by the auth library. Email verification required before a vendor application is accepted.
- Uploads: check MIME type and size on the server. Images only for products. PDF or image for vendor documents, served through signed, expiring links to admins only.
- Security headers: Content-Security-Policy, HSTS, X-Content-Type-Options, Referrer-Policy, frame-ancestors none.
- Secrets only in environment variables. No secret has the `NEXT_PUBLIC_` prefix. Add a pre-commit secret scan.
- Cron routes require the `CRON_SECRET` header.
- Personal data: store only what is needed, let buyers delete their account, keep bank details readable to the vendor owner and admins only.

## C4. Testing

- Unit tests for everything in `packages/core`: pricing, commission resolution, coupon allocation, ledger balance, every state-machine transition, refund proportioning.
- Integration tests for webhook handlers using recorded sandbox payloads, including duplicate delivery and out-of-order events.
- Playwright flows in both locales: guest checkout, registered checkout with two vendors in one cart, payment failure and retry, vendor ships an order, buyer returns an item, admin refunds, vendor application and approval.
- Seed script that creates one admin, three vendors, twelve categories and sixty products with bilingual content and placeholder images.

## C5. GitHub

- `main` is protected: pull request required, CI must pass.
- One branch per phase, named `phase-N-short-name`. Conventional commit messages. Small commits.
- CI on every pull request: install, lint, type-check, unit tests, build, translation key check. Playwright runs against the Vercel preview URL.
- Each pull request description lists what was built, how to test it, new environment variables, and migrations.

## C6. Vercel

- Link the repo with the Vercel Git integration. Root directory `apps/web`. Enable Turborepo remote caching.
- Every pull request gets a preview deployment. `main` deploys to production.
- Preview deployments use a separate Neon database branch and sandbox payment keys. Production uses its own database and, at launch, live keys.
- Migrations run with `prisma migrate deploy` in the build step. Never run `migrate dev` or `db push` against production.
- Cron jobs in `vercel.json`: payment reconciliation, stock reservation expiry, order auto-completion after the return window, weekly payout batch.
- Register webhook URLs for preview and production separately in the MyFatoorah portal. Tell me the exact URL to paste.

---

# Part D: Build plan

Build in this order. Each phase depends on the ones before it, ships as one pull request, and must pass its gate before the next begins.

| Phase | Outcome | Gate to pass |
| --- | --- | --- |
| 0. Foundations | Empty app live on Vercel from GitHub with database connected | Production URL loads. CI green |
| 1. Shell and languages | Bilingual layout, component library, RTL working | Every page switches EN/AR with correct direction |
| 2. Auth and roles | Sign-up, sign-in, roles, protected areas | Role tests pass. Vendor and admin areas blocked for buyers |
| 3. Catalogue core | Schema, categories, products, variants, images, seed data | Seeded catalogue visible through admin screens |
| 4. Vendor onboarding | Application, approval, vendor dashboard, product management | A new vendor can apply, be approved, and list a product |
| 5. Storefront | Home, category, search, product, vendor pages | Buyer can find any seeded product in both languages |
| 6. Cart and checkout | Multi-vendor cart, addresses, shipping, order creation | Two-vendor cart creates one Order with two VendorOrders |
| 7. Payments | Provider layer, MyFatoorah, webhooks, reconciliation | Sandbox payments succeed and fail correctly for every enabled method |
| 8. Fulfilment and returns | Vendor order handling, emails, returns, refunds | Full order lifecycle works end to end in sandbox |
| 9. Commission and payouts | Rules, ledger, statements, payout batches | Ledger balances to zero in tests. Payout batch matches expected totals |
| 10. Admin console | Moderation, coupons, content, reports, audit log | Admin can run the marketplace without database access |
| 11. Trust and growth | Reviews, wishlist, SEO, performance, accessibility | Lighthouse mobile scores of 90 or more on key pages |
| 12. Hardening and launch | Security review, load check, monitoring, go-live | Launch checklist fully ticked |

## Phase 0: Foundations

- Initialise Turborepo with pnpm, `apps/web` and the five packages from A3.
- Configure TypeScript strict, ESLint, Prettier, Husky pre-commit with lint-staged and a secret scan.
- Write `CLAUDE.md` with commands, conventions, and pointers to the docs folder. Create `DECISIONS.md`, `PROGRESS.md`, `RUNBOOK.md`.
- Confirm the git remote is the existing `alsouq` repo, push the scaffold on a branch, protect `main`, add the CI workflow.
- Link Vercel, set the root directory, add Neon through Vercel Storage, pull environment variables locally.
- Add Prisma with one placeholder model, run the first migration, add a `/api/health` route that queries the database.
- Add Sentry and Vercel Analytics.

**Acceptance:** production URL returns the health check as OK. A test pull request gets a preview URL and green CI. `.env.example` is complete. No secret is in the repo.

## Phase 1: Shell and languages

- Install next-intl with `/en` and `/ar` routing, locale switcher, and `dir` handling.
- Set up Tailwind theme tokens, fonts for both scripts, and shadcn/ui.
- Build the component library listed in C2 with RTL checked for each component.
- Build header (logo, search bar, language switch, account, cart), mega-menu placeholder, footer, mobile navigation.
- Add the translation key parity check to CI.
- Add 404, error and loading states in both languages.

**Acceptance:** a showcase page at `/en/dev/ui` and `/ar/dev/ui` renders every component correctly in both directions at 375 px wide and on desktop.

## Phase 2: Auth and roles

- Integrate Better Auth with email and password, email verification, password reset, Google sign-in.
- Add User, Session, Account, Address models and migrations.
- Implement role checks as server helpers: `requireUser`, `requireVendor`, `requireAdmin`.
- Build sign-up, sign-in, forgot password, verify email and profile pages in both languages.
- Send auth emails through Resend with bilingual templates.
- Add rate limiting with Upstash on all auth endpoints.
- Seed one admin user from environment variables.

**Acceptance:** Playwright covers sign-up, verification, sign-in and reset. A buyer hitting `/vendor` or `/admin` is redirected. Five failed sign-ins in a minute are throttled.

## Phase 3: Catalogue core

- Add Category, Product, ProductVariant, ProductImage, Attribute, AttributeValue models with indexes.
- Enable `pg_trgm` and create search indexes on English and Arabic names.
- Build image upload to Vercel Blob with server-side validation and reordering.
- Build admin screens for the category tree and attributes.
- Write the seed script: twelve categories, three vendors, sixty bilingual products with variants.
- Write the data-access layer with vendor scoping and its isolation tests.

**Acceptance:** `pnpm db:seed` produces a full catalogue. Admin can create, reorder and translate categories. Isolation tests pass.

## Phase 4: Vendor onboarding and dashboard

- Add Vendor, VendorMember, VendorDocument, VendorBankAccount, ShippingRate models.
- Build the vendor application form with document upload and bank details.
- Build the admin vendor queue: view documents through signed links, approve, reject with reason, suspend.
- Build the vendor dashboard layout and home.
- Build product create and edit with variants, images and both languages. Product review workflow.
- Build CSV bulk upload with template and error report.
- Build inventory, shipping settings, store settings and staff invitations.
- Send application received, approved and rejected emails.

**Acceptance:** Playwright flow passes: user applies, admin approves, vendor adds a product with two variants, admin approves it, it is live in the database.

## Phase 5: Storefront

- Home page fed by Banner and featured flags.
- Category page with filters, sorting, pagination and URL-driven state.
- Search results page and autocomplete endpoint with rate limiting.
- Product page with gallery, variant picker, stock state, vendor card, related products.
- Vendor storefront page.
- Metadata, `hreflang`, sitemaps, structured data.
- Caching: static with revalidation for catalogue pages, tag-based revalidation when products change.

**Acceptance:** searching an Arabic product name with one typo returns the product. Category filters combine correctly. A product edit appears on the storefront within one minute.

## Phase 6: Cart and checkout

- Add Cart, CartItem, Coupon, Order, VendorOrder, OrderItem models.
- Guest cart by signed cookie, merge on sign-in, stock and price re-validation on every load.
- Cart page grouped by vendor with per-vendor shipping.
- Pricing engine in `packages/core`: subtotal, shipping, coupon allocation, tax from Settings, total. Fully unit-tested.
- Checkout steps: address with Zone, Street, Building. Delivery. Payment method choice.
- Order creation in one transaction with stock reservation and price snapshot. Status PENDING_PAYMENT.
- Order number generator.

**Acceptance:** a cart with items from two vendors creates one Order and two VendorOrders with correct totals. A price or stock change in another tab is caught at checkout. Pricing tests cover at least 25 cases.

## Phase 7: Payments

- Write `docs/PAYMENTS.md` first, as described at the top of Part B, and wait for my review.
- Add Payment, PaymentEvent, Refund models.
- Implement the `PaymentProvider` interface and a fake provider for tests.
- MyFatoorah adapter: create payment, status check, webhook verification, supplier creation, split payload, refund.
- Checkout shows only the payment methods MyFatoorah returns for the account, with fees and logos.
- Return pages for success, failure and pending, in both languages.
- Webhook route handler following the five rules in B4.
- Reconciliation cron and stock-reservation expiry cron.
- Admin payments screen with event log and manual re-check.

**Acceptance:** in sandbox, a successful payment moves the order to PAID exactly once even when the webhook is delivered twice. A failed payment releases stock. Closing the browser before returning still results in PAID through the webhook. An invalid signature is rejected.

## Phase 8: Fulfilment and returns

- Vendor order screens: accept, packing slip PDF, packed, shipped with tracking, delivered.
- Buyer order list and tracking page per VendorOrder.
- Emails for order placed, shipped, delivered, cancelled, refunded, plus new-order email to the vendor.
- In-app notifications for vendor and buyer.
- Cancellation before shipment with automatic refund.
- Return request by buyer inside the return window, vendor decision, received confirmation, refund.
- Auto-completion cron after the return window.

**Acceptance:** Playwright runs a full lifecycle in sandbox: buy, ship, deliver, request return, approve, refund. Every status change sends the right email in the buyer's language.

## Phase 9: Commission and payouts

- Add CommissionRule, LedgerEntry, Payout, PayoutItem models.
- Commission resolver with precedence vendor, category, global.
- Ledger postings for sale, shipping, commission, gateway fee, refund, payout. A test asserts debits equal credits after every scenario.
- Vendor earnings page, statements and CSV export.
- Weekly payout batch cron, admin payout review, bank-file export, mark as paid.
- Negative balance netting after post-payout refunds.

**Acceptance:** for a scripted set of 20 orders with mixed coupons, refunds, split and unsplit payments, vendor balances and platform commission match hand-calculated expected values to the dirham.

## Phase 10: Admin console

- Admin dashboard with headline numbers and pending queues.
- Order oversight with notes, cancel, full and partial refund.
- Coupons: percentage or fixed, platform- or vendor-funded, limits, date range.
- Banners and static pages editor in both languages.
- Reports with date range and CSV export.
- User management, Settings screen, audit log viewer.

**Acceptance:** every admin task in A11 can be completed through the interface. Every admin money action appears in the audit log.

## Phase 11: Trust and growth

- Reviews with verified-purchase rule, vendor replies, report and moderation.
- Wishlist.
- Rating aggregates on products and vendors.
- Performance pass: image sizes, font loading, bundle analysis, database query review with indexes.
- Accessibility pass: keyboard navigation, focus states, labels, contrast, screen-reader check in both languages.
- Cookie notice and policy pages.

**Acceptance:** Lighthouse mobile scores of 90 or more for performance, accessibility and SEO on home, category and product pages. No critical axe violations.

## Phase 12: Hardening and launch

- Security review of every Server Action and route handler against C3. Fix and re-test.
- Dependency audit and update.
- Load check on search, product page and checkout creation.
- Database backup and restore drill on Neon, documented in `RUNBOOK.md`.
- Sentry alerts for webhook failures, payment mismatches and cron failures.
- Connect the domain, set production environment variables, register the live webhook URL.
- One real low-value purchase and refund with live keys, once with a Qatar card and once with a foreign-issued card, done by me.
- Write the runbook: how to refund, re-run a payout, replay a webhook, roll back a deployment.

**Acceptance:** launch checklist in `docs/RUNBOOK.md` fully ticked and signed off by me.

---

# Part E: Things only I can decide

Ask me about each of these when its phase starts. Do not guess.

| Item | Ask me at |
| --- | --- |
| Final name, domain and brand colours | Phase 1 |
| Cash on delivery: in or out (currently out) | Phase 6 |
| Delivery model (currently vendors ship their own orders at flat rates) | Phase 6 |
| Tax rate (currently configurable, default 0%) | Phase 6 |
| MyFatoorah account: are foreign-issued cards and Multi-Vendor enabled | Phase 7 |
| How vendor money is held when a payment is not split by the gateway | Phase 7 |
| Return window, payout schedule, minimum payout | Phase 8 |
| Commission rates: global default and category overrides | Phase 9 |
| Native review of Arabic copy | Phase 11 |
| Legal pages: vendor agreement, buyer terms, privacy, returns policy | Phase 12 |
