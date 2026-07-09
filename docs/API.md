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

## Admin

### `GET /api/admin/summary`
Live marketplace stats + the AI-generated operations daily summary.

## Coupon codes

`NEST10` (10% off) · `SALAM15` (15% off first booking) · `PEARL25` (QAR 25 off, Pearl launch).
