import {
  FitScoreInput as FitScoreInputSchema,
  type FitScoreInput,
  type FitScoreBreakdown,
  type NormalizedOffer,
  type TripIntent,
  type TastePrefs,
} from "@voyara/contracts";

/**
 * Fixed weights. There is no supplier-margin weight because there is no
 * supplier-margin signal — the input type (FitScoreInput) has no such field.
 */
const WEIGHTS: Record<keyof FitScoreInput, number> = {
  tasteMatch: 0.32,
  priceVsBudget: 0.22,
  location: 0.22,
  reviews: 0.14,
  scheduleQuality: 0.1,
};

/**
 * The trust moat. This function accepts ONLY FitScoreInput. Any extra keys
 * (e.g. a smuggled `margin`) are stripped by the schema parse before scoring,
 * so a supplier can never pay for position. Enforced by unit test.
 */
export function fitScore(rawInput: FitScoreInput): FitScoreBreakdown {
  // Parse strips unknown keys — margin can never reach the math.
  const input = FitScoreInputSchema.parse(rawInput);

  const contributions: Record<string, number> = {};
  let score = 0;
  for (const key of Object.keys(WEIGHTS) as (keyof FitScoreInput)[]) {
    const c = input[key] * WEIGHTS[key];
    contributions[key] = round3(c);
    score += c;
  }

  const signals: string[] = [];
  if (input.tasteMatch >= 0.7) signals.push("Strong match to your saved taste profile");
  if (input.priceVsBudget >= 0.7) signals.push("Comfortably under your budget");
  else if (input.priceVsBudget <= 0.3) signals.push("Near the top of your budget");
  if (input.location >= 0.7) signals.push("Right in your preferred area");
  if (input.reviews >= 0.8) signals.push("Highly rated by past guests");
  if (input.scheduleQuality >= 0.8) signals.push("Convenient schedule");

  return {
    score: round3(Math.min(1, score)),
    weights: { ...WEIGHTS },
    contributions,
    signals,
  };
}

/**
 * Derive fit signals from an offer + intent + taste. This is the ONLY place
 * offer data is read, and it deliberately ignores `offerPayload` economics.
 */
export function buildFitInput(
  offer: NormalizedOffer,
  intent: TripIntent,
  taste?: TastePrefs,
): FitScoreInput {
  const styleWanted = new Set(
    [...intent.hotelStyle, ...(taste?.hotelStyle ?? [])].map((s) => s.toLowerCase()),
  );
  const styleHits =
    styleWanted.size === 0
      ? 0.5
      : offer.style.filter((s) => styleWanted.has(s.toLowerCase())).length /
        styleWanted.size;
  const amenityWanted = new Set((taste?.amenities ?? []).map((a) => a.toLowerCase()));
  const amenityHits =
    amenityWanted.size === 0
      ? 0.5
      : offer.amenities.filter((a) => amenityWanted.has(a.toLowerCase())).length /
        amenityWanted.size;
  const tasteMatch = clamp01(0.6 * styleHits + 0.4 * amenityHits);

  // priceVsBudget: 1 well under, 0 at/over the cap.
  const perNight = offer.perNight?.amountMinor ?? offer.price.amountMinor;
  const cap = intent.budgetPerNightMinor;
  const priceVsBudget =
    cap == null ? 0.6 : clamp01(1 - perNight / cap);

  // location: closeness to anchor + neighborhood preference.
  const wantedHoods = new Set(
    [...intent.neighborhoods, ...(taste?.neighborhoods ?? [])].map((n) => n.toLowerCase()),
  );
  const hoodHit = offer.neighborhood && wantedHoods.has(offer.neighborhood.toLowerCase());
  const distKm = offer.distanceToAnchorKm ?? 5;
  const proximity = clamp01(1 - distKm / 8);
  const location = clamp01(hoodHit ? Math.max(0.85, proximity) : proximity);

  const reviews = offer.rating != null ? clamp01(offer.rating / 5) : 0.5;
  const scheduleQuality =
    offer.kind === "FLIGHT" ? clamp01(offer.scheduleQuality ?? 0.5) : 1;

  return { tasteMatch, priceVsBudget, location, reviews, scheduleQuality };
}

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}
function round3(n: number): number {
  return Math.round(n * 1000) / 1000;
}
