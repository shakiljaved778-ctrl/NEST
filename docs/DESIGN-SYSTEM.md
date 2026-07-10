# NEST Design System

**Style:** clean modern premium — card-based layouts, generous spacing, trust-forward UI.
Matches the investor deck: navy ground, gold accents, serif display headings.

## 1. Color tokens

| Token | Hex | Tailwind key | Usage |
|---|---|---|---|
| Nest Navy | `#14263F` | `navy` | Primary background, headers, text on light |
| Nest Gold | `#D9A62E` | `gold` | Logo, primary CTA accents, premium badges, ratings |
| Nest Teal | `#0E9488` | `teal` | Secondary actions, success states, provider identity |
| Pearl White | `#F7F9FC` | `pearl` | Card backgrounds, light surfaces |
| Ink | `#1A2233` | `ink` | Body text |
| Mist | `#E6EBF2` | `mist` | Dividers, disabled states |
| Alert Red | `#D64545` | `alert` | Errors, safety escalations |

Derived scales live in `tailwind.config.ts` (`navy-50…800`, `gold-soft`, `teal-soft`).

## 2. Typography

- **Latin UI:** Inter — 400 / 600 / 700
- **Display headlines:** Playfair Display / Lora (serif, deck-matching) — `font-display`
- **Arabic:** IBM Plex Sans Arabic or Noto Kufi Arabic, full RTL mirroring
- **Scale:** 12 / 14 / 16 / 20 / 24 / 32

## 3. Layout & shape

- 8-pt spacing grid
- Radius 16px on cards (`card` utility), 999px on chips/pills
- Elevation: y=2 blur=12 at 8% navy
- Tap targets ≥48px
- Bottom tab bar (customer): Home · Bookings · **Nest AI** · Wallet · Profile — AI is a first-class tab

## 4. Trust-forward components

- **Verified badge** — teal check chip on every provider card
- **Safety panel** — during live tracking: provider identity, background-check label, SOS
- **Transparent quote** — line-item pricing (package, add-ons, surcharges, discounts) before checkout
- **Gender preference** — offered on in-home categories where operationally available

## 5. States (mandatory on every screen)

default · loading (skeleton) · empty · error · offline

## 6. Micro-interactions

- Skeleton loaders on all fetches
- Provider-matching pulse animation ("Finding your pro…")
- Confetti on booking confirmation
- Haptic on provider job-accept
- Dark navy mode for the provider app (field use in sunlight/night)

## 7. RTL & localization

- Arabic and Urdu render fully mirrored (`dir="rtl"`); use logical CSS properties (`ms-`/`me-`, `text-start/end`) — already enforced across the codebase
- Never mirror icons that imply direction of time (clocks, progress)
- Language switcher accessible from every screen
- 6 locales: EN · AR · HI · UR · ML · TL (`lib/i18n.ts`)

## 8. Accessibility

WCAG 2.2 AA · dynamic type support · VoiceOver/TalkBack labels in all 6 languages · contrast: body text on pearl ≥ 7:1 (Ink), on navy use white/navy-100.

## 9. Brand assets

- Logo: navy house mark in gold circle on deep navy — `assets/brand/nest-logo.png`
- App icon: gold circle crop · Splash: centered on navy `#14263F` · Header mark: 24px
