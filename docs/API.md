# NEST Solutions — API Reference (MVP)

Base URL: `http://localhost:4200`

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
