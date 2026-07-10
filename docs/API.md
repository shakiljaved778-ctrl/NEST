# NEST Solutions — API Reference (MVP)

Base URL: `http://localhost:4200`

## Auth

### `POST /api/auth/otp/request`
```json
{ "phone": "+97455123456" }
```
Issues a 4-digit code (SMS in production; the demo build returns it as `demoCode`, fixed
to `0000`). 30-second resend cooldown, 5-minute TTL, 5 attempts max.

### `POST /api/auth/otp/verify`
```json
{ "phone": "+97455123456", "code": "0000", "role": "customer" }
```
Returns a 24-hour session token. Production swaps the token store for JWT + rotating
refresh tokens with the same request/verify semantics.

## Catalog

### `GET /api/catalog`
Returns the 15-service catalog with packages, add-ons and Qatar launch zones.

## Pricing

### `POST /api/quote`
```json
{ "serviceId": "ac-technician", "packageId": "ac-service", "addonIds": ["ac-duct"], "slot": "18:00", "urgent": true, "couponCode": "NEST10", "nestPlus": false }
```
Returns line items, peak/urgency surcharges, discounts and the total. Evening slots
(17:00–21:00) add +10%; urgent bookings add QAR 30.

## Matching

### `POST /api/match`
```json
{ "serviceId": "house-cleaning", "zoneId": "the-pearl", "language": "tl", "genderPreference": "female", "urgent": false }
```
Returns the top providers with match score and per-factor breakdown
(distance / availability / skill / rating / completion / response / language / preference).

## Bookings

### `GET /api/bookings`
List all bookings (seeded + created).

### `POST /api/bookings`
Creates a booking: quotes the price, runs AI matching, and assigns the best provider.
Required: `serviceId`, `packageId`, `zoneId`, `date`, `slot`, `customerName`.
Optional: `addonIds`, `address`, `urgent`, `couponCode`, `paymentMethod`, `language`,
`genderPreference`, `nestPlus`.

### `GET /api/bookings/:id`
### `PATCH /api/bookings/:id`
```json
{ "status": "completed", "rating": 5 }
```
Marking a booking `completed` automatically captures its authorized payment and returns
the payment with the issued e-invoice.

## Payments (mock PSP — mirrors the Qatar-licensed production flow)

### `POST /api/payments/intent`
```json
{ "bookingId": "NB-1042", "method": "card" }
```
Creates the payment intent from the booking quote (idempotent per booking).
Methods: `card`, `apple_pay`, `google_pay`, `wallet`.

### `POST /api/payments/confirm`
```json
{ "paymentId": "PAY-1000" }
```
Pre-authorization: funds held, nothing charged. Capture happens on booking completion
with a commission split (cleaning 20% · technical 15% · salon 25% · care 12%) and a
VAT-ready e-invoice (`INV-YYYY-NNNNNN`, VAT line at 0% until Qatar's 5% VAT lands).

### `POST /api/refunds`
```json
{ "paymentId": "PAY-1000", "amount": 30, "reason": "late arrival compensation" }
```
Partial or full; over-refunds are rejected.

### `GET /api/payments`
Admin ledger: all payments and refunds.

## Providers

### `GET /api/providers/:id/quality`
AI quality score (0–100, banded) from rating, checklist completion, photo compliance,
chat sentiment, repeat rate, refund rate and time-on-job — with actionable flags
(e.g. `rating_below_4_3_weekly_review`).

## Subscriptions, wallet & chat

### `GET /api/subscriptions?customer=Amina` · `POST /api/subscriptions`
Nest+ plans (Essential 199 · Family 449 · Villa AMC 899 QAR/mo). Subscribe with
`{ "customer", "planId" }`, cancel with `{ "subscriptionId", "cancel": true }`.
Active plans apply their discount (10–15%) to every booking quote.

### `GET /api/wallet?customer=demo` · `POST /api/wallet`
Ledger-derived balance (never stored), credits (`topup` / `refund_credit` / `reward` /
`promo`) and debits with overdraft protection, plus active coupons.

### `GET /api/chat/:bookingId` · `POST /api/chat/:bookingId`
```json
{ "sender": "provider", "text": "I am on my way" }
```
Messages are stored with original AND translation into the recipient's language
(customer's booking language by default) and an emergency flag ops can act on.

## Analytics

### `POST /api/events`
```json
{ "name": "booking_started", "actor": "u42", "properties": { "serviceId": "plumbing" } }
```
Named taxonomy enforced: `booking_started`, `quote_viewed`, `payment_succeeded`,
`rebook_tapped`, `ai_assistant_booked`, `provider_accepted`, `job_completed`,
`rating_submitted`, `complaint_filed`, `subscription_started`.

### `GET /api/admin/funnel`
Cohort funnel over the golden path; any step with >20% drop is flagged `killOrFix`
per the weekly review rule.

## AI layer

### `POST /api/ai/assistant`
```json
{ "message": "My AC is not cooling", "language": "en" }
```
Returns `reply`, `suggestedServiceId`, `suggestedPackageId`, `followUps`, and
`safetyEscalation`. Emergency keywords bypass booking suggestions entirely.

### `POST /api/ai/complaint`
```json
{ "text": "The provider arrived 40 minutes late and the sofa got stained" }
```
Returns `category`, `priority`, `sentiment`, `refundRisk`, `humanEscalation`, `summary`.

### `POST /api/ai/translate`
```json
{ "message": "I am on my way", "targetLang": "ar" }
```
Real-time chat translation across EN ⇄ AR ⇄ HI ⇄ UR ⇄ ML ⇄ TL with automatic
source-language detection (script + keywords) and an `flagEmergency` marker in any
language. Unknown phrases pass through with `translated: false` (degradation mode).

## Admin

### `GET /api/admin/summary`
Live marketplace stats + the AI-generated operations daily summary.

### `GET /api/admin/pilot`
90-day Doha pilot scoreboard: the five Seed-readiness gates with live progress.

### `GET /api/admin/fraud`
Live fraud scan: coupon abuse, refund abuse, fake bookings (cancellation ratios) and
rating manipulation, ranked by risk score.

## Coupon codes

`NEST10` (10% off) · `SALAM15` (15% off first booking) · `PEARL25` (QAR 25 off, Pearl launch).
