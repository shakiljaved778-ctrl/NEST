# Phase 4 report: Demo bank app + `<amil-insight>` widget

**Status:** complete. Waiting for go-ahead to start Phase 5 (remaining packs, proactive alerts,
explain-my-charge).

## Acceptance criterion

**Playwright: Khalid sees the points insight in both languages and can deep-link to "Redeem
points"**: ✅ `apps/demo-bank/e2e/insights.spec.ts`, 5 tests passing against the real stack (AMIL
API + demo bank + PostgreSQL + Redis, both servers started by Playwright from cold):

| Test                 | Checks                                                                                                                                                                                                                                                                                                                                        |
| -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Khalid, English      | The persona switcher logs him in. Card → Close card shows the card _"Closing this card forfeits 42,000 points (about QAR 420.00)"_: severity critical, fact chip, "as of" footer. Continue is disabled until **I understand** is ticked. **Redeem points first** is the first option and deep-links to `/cards/card_khalid_platinum/rewards`. |
| Khalid, Arabic       | `<html dir="rtl">` and the widget is `dir="rtl"`. Arabic headline _"إغلاق هذه البطاقة يُفقدك 42,000 نقطة (نحو 420.00 ر.ق)"_, Arabic footer. **استبدل النقاط أولاً** deep-links to the rewards screen.                                                                                                                                         |
| Khalid continues     | After acknowledging, **Continue closing the card** leads to the bank's own confirm screen ("AMIL never closes cards or moves money").                                                                                                                                                                                                         |
| Fatima settles early | A critical card in the form _"Settling on {date} instead of today costs QAR 4,000.00 less"_, mentioning the ibra. **Settle on the cheaper date** deep-links to `/finance/fin_fatima_murabaha/settle/schedule?date=…`.                                                                                                                         |
| No consent (Priya)   | A generic card with no figures (`data-kind="generic"`, no fact chips).                                                                                                                                                                                                                                                                        |

Other checks: lint, typecheck and build are clean, with **558 unit and integration tests** (widget 8
new, ui 1 new, rule-packs 262). The Playwright suite now also runs in CI (a new `e2e` job).

## What was built

### `packages/widget`: `<amil-insight>` (Lit web component)

- **Two ways to use it.** The element runs the check itself (`api-base`, `token`, `action`,
  `customer-ref`, `card-id` / `finance-id`, `locale`), or renders a `result` the host already has.
- **What it renders:** headline, body, fact chips (label + display value, wrapped in `<bdi>`), a
  "Why am I seeing this?" disclosure, options and the footer.
- **Critical cards:** the continue-type option is disabled until **I understand** is ticked. The
  loss-avoiding options always stay available.
- **Inform, never execute:**
  - a click records the customer's response with the session token (`chose_option`, `continued`,
    `talk_to_someone`, `dismissed`);
  - the element then emits `amil-option` with the bank deep link and never navigates itself.
- **Failure:** a neutral "Information unavailable" line plus `amil-unavailable`. No error details
  are shown.
- **Theming:** `--amil-*` CSS custom properties, set by the demo bank from `Bank.brandTokens`.
- **RTL:** `dir` and `lang` follow `locale`, the accent border uses logical properties, and the
  Arabic copy comes from `@amil/i18n`.
- **Accessibility:** `role="region"` labelled by the headline, `aria-live="polite"`, real
  `<button>`s and a labelled checkbox.

### `apps/demo-bank`: Doha Demo Bank (fictional)

- **Shell:** phone frame on desktop, full-bleed on mobile. Brand header, bottom navigation, and
  "Demo data — Doha Demo Bank is fictional" on every page.
- **Languages:** en/ar via next-intl, with the locale in a cookie (D-025). The whole app flips to
  RTL. A header toggle switches language anywhere, and Settings has one too.
- **Persona switcher** (demo-only) for all 25 synthetic customers, the five named personas first.
- **Screens:**
  - Home: accounts, cards with points, finance, deposits.
  - Card detail, then the **Close card** flow: AMIL check, then the bank's own confirm.
  - Finance detail, then the **Settle early** flow: AMIL check, then the bank's own confirm.
  - Deep-link targets: rewards, instalments, scheduled settlement, partial prepayment, talk to
    someone.
  - Settings: language, and AMIL consent on/off, recorded with AMIL by the bank backend.
  - Placeholders for Alerts and Ask AMIL (Phases 5–6).
- **Integration pattern** (D-024, D-027):
  - The Next server is the bank backend. It mints a 15-minute session token over HMAC (the secret
    stays server-side).
  - The browser widget calls AMIL directly with that token.
  - `ddb://…` deep links map to app routes.
  - When AMIL shows nothing, or is unreachable, the bank's own Continue button appears.

### `packages/ui`

- shadcn-style primitives (`Button`, `Card`, `Badge`, `cn`) built on cva + tailwind-merge, themed
  by `--ui-*` variables (D-026).

### Fixes along the way

- **Fact chips now show only figures that appear in the copy as rendered for this customer**
  (`renderedFactKeys`). Previously, figures referenced only by hidden sections leaked in as chips.
- **The offline mock's shortening of long approved copy no longer splits at decimal points.** It
  used to turn "QAR 1,250.00" into "QAR 1,250.", which was numerically equal and so passed the
  validator, but was wrong as copy.

## Screenshots

`docs/screenshots/`:

- `phase4-home-en.png`
- `phase4-khalid-card-close-en.png`
- `phase4-khalid-card-close-ar.png`
- `phase4-close-phone-ar.png`
- `phase4-fatima-settle-en.png`

## How to run

```bash
pnpm db:migrate && pnpm db:seed
pnpm dev                                  # API :4000, demo bank :3000, console :3001
# open http://localhost:3000 -> pick Khalid -> Platinum card -> Close card; toggle العربية in the header

pnpm --filter @amil/demo-bank build
pnpm --filter @amil/demo-bank e2e         # Playwright (starts API + demo bank if not running)
```

## Stubbed or deferred

- **Deposits:** listed on Home, but the "Break deposit" flow is Phase 5 with `deposit.break`.
- **Later-phase screens:** "Change salary account", the statement with tappable charges and the
  alerts inbox (Phase 5), and Ask AMIL (Phase 6) are placeholders.
- **Bank-side destinations** (redeem, schedule, prepay, callback) are demo screens. AMIL's job ends
  at the deep link.
- **Docker images:** the demo bank now reads PostgreSQL. Its standalone image is configured
  (`serverExternalPackages`, compose env), but there is still no Docker daemon here to exercise it
  end to end.
- **Widget consumers:** the console app (Phase 7) and an `<amil-assistant>` element (Phase 6).

## Where this work lives

The work is pushed to the temporary branch **`amil-ai-export`** on NEST (Phases 1–4; no shared
history with NEST). Import it into `amil-ai` with
`git fetch https://github.com/shakiljaved778-ctrl/NEST amil-ai-export && git push origin FETCH_HEAD:refs/heads/main`.

## Open questions for you

1. **Fact chips.** Critical cards show up to ten chips under the text. That's useful for
   transparency, but busy on a phone. Keep all, or cap at the first four with a "more figures"
   expander?
2. **Phase 3 questions still open** (wording model; mTLS at the bank's ingress). The defaults are
   in place (D-029).
