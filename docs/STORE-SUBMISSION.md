# NEST — App Store Submission Kit (EN / AR)

Covers the customer app ("Nest — Home Services Qatar") and provider app ("Nest Pro").
Built via EAS Build → TestFlight + Google Play internal → closed beta (50 users) →
phased rollout 10% → 50% → 100%. OTA JS fixes via EAS Update.

---

## 1. Customer app listing

### App name
- **EN:** Nest — Home Services Qatar
- **AR:** نست — خدمات المنزل قطر

### Subtitle (iOS, ≤30 chars)
- **EN:** Trusted pros. Fair prices.
- **AR:** محترفون موثوقون بأسعار عادلة

### Short description (Google Play, ≤80 chars)
- **EN:** Book verified home services in Doha — cleaning, AC, plumbing & more.
- **AR:** احجز خدمات منزلية موثوقة في الدوحة — تنظيف، تكييف، سباكة والمزيد.

### Full description

**EN:**

> **One app for a trusted home.**
> Nest connects Qatar households with verified home-service professionals — transparent prices, live tracking, and AI that books the right service in seconds.
>
> • **Verified professionals** — QID-checked, background-verified, trained and rated
> • **Transparent pricing** — line-item quotes before you pay, no surprises
> • **Book in 5 taps** — cleaning, deep cleaning, AC service, plumbing, electrical
> • **Nest AI assistant** — describe the problem ("my AC is not cooling") and get the right visit booked
> • **Live tracking & safety panel** — see who's coming, when, with verified identity
> • **Chat in your language** — English, العربية, हिन्दी, اردو, മലയാളം, Tagalog with real-time translation
> • **Nest+** — recurring home-care plans for hassle-free living
>
> Serving West Bay, The Pearl, Lusail and expanding across Doha.

**AR (RTL):**

> **تطبيق واحد لمنزل موثوق.**
> يربط "نست" العائلات في قطر بمحترفي الخدمات المنزلية الموثوقين — أسعار شفافة، تتبع مباشر، وذكاء اصطناعي يحجز الخدمة المناسبة في ثوانٍ.
>
> • **محترفون موثوقون** — تحقق من الهوية القطرية والسجل، مدربون ومقيّمون
> • **أسعار شفافة** — عرض سعر مفصل قبل الدفع، بلا مفاجآت
> • **احجز في ٥ نقرات** — تنظيف، تنظيف عميق، صيانة تكييف، سباكة، كهرباء
> • **مساعد نست الذكي** — صف المشكلة ("المكيف لا يبرد") ليحجز لك الزيارة الصحيحة
> • **تتبع مباشر ولوحة أمان** — اعرف من القادم ومتى، بهوية موثقة
> • **دردشة بلغتك** — ست لغات مع ترجمة فورية
> • **نست+** — باقات عناية منزلية دورية براحة تامة
>
> نخدم الخليج الغربي واللؤلؤة ولوسيل، ونتوسع في الدوحة.

### Keywords (iOS)
- **EN:** home services,cleaning,AC repair,plumber,electrician,doha,qatar,maid,handyman,نظافة
- **AR:** خدمات منزلية,تنظيف,تكييف,سباكة,كهربائي,الدوحة,قطر,مدبرة,صيانة

### Categories
- iOS: Lifestyle (primary), Utilities (secondary)
- Android: House & Home

## 2. Provider app listing ("Nest Pro")

- **EN name:** Nest Pro — Work in Qatar · **AR:** نست برو — اعمل في قطر
- **Short:** EN "Get home-service jobs in Doha. Fair commission, weekly payouts." / AR "احصل على وظائف خدمات منزلية في الدوحة. عمولة عادلة ودفعات أسبوعية."
- Highlights: job requests with earnings preview · offline-first for basements/weak signal · training academy · quality score · 6-language UI.

## 3. Screenshots (per store, EN + AR sets)

1. Home — service tiles + Nest AI entry ("One app for a trusted home")
2. Booking flow — package + transparent quote ("Know the price before you book")
3. Provider matching — verified badge card ("Verified pros only")
4. Live tracking + safety panel ("See who's coming")
5. AI assistant chat ("Just say what's wrong")
6. Nest+ plans ("Home care on autopilot")

Device frames: iPhone 15 Pro (6.7"), iPad 13", Pixel 8. Navy background, gold accents, Playfair headlines; AR sets fully mirrored.

## 4. Privacy & data safety

**Apple privacy labels — data linked to user:** name, phone number, precise location (during service), payment info (tokenized via PSP, never stored), photos (job documentation), messages (chat).
**Google Data Safety:** same set; data encrypted in transit (TLS) and at rest (KMS); deletion via in-app account deletion (PDPPL-compliant); no data sold; no third-party ads.

**Provider app additionally:** government ID documents (KYC, KMS-encrypted, S3 pre-signed upload), work-permit status.

## 5. Review notes (Apple / Google)

- Demo account: reviewer phone +974-DEMO-XXXX with fixed OTP `000000` (staging flag).
- Payments run in PSP sandbox until production PSP approval (Qatar Central Bank-licensed gateway); no IAP — physical services exempt.
- Background location used only during an active job for provider ETA (both stores' declaration filed).

## 6. Assets

- App icon: gold-circle crop of `assets/brand/nest-logo.png` (1024×1024, no alpha for iOS)
- Splash: logo centered on navy `#14263F`
- Feature graphic (Play): navy ground, logo left, tagline right, EN + AR variants

## 7. Pre-submission checklist

- [ ] EN + AR store listings proofread by native speaker
- [ ] Screenshots regenerated from the release build (both languages)
- [ ] Privacy labels match the actual SDK data flows (audited)
- [ ] Arabic terms, privacy and refund policy URLs live
- [ ] Demo OTP account enabled on staging
- [ ] Age rating questionnaires completed (4+ / Everyone)
- [ ] EAS production profile signed; version/build numbers bumped
