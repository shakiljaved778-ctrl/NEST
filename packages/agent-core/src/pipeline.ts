import {
  type TripIntent,
  type TripPresentation,
  type TripOption,
  type NormalizedOffer,
  type AssembledSegment,
  type TastePrefs,
  type Money,
  money,
  addMoney,
} from "@voyara/contracts";
import {
  type LodgingAdapter,
  type AirAdapter,
} from "@voyara/inventory-mesh";
import { HeuristicForecastEngine, type ForecastEngine } from "@voyara/forecast";
import { type Planner, HeuristicPlanner } from "./planner.js";
import { buildFitInput, fitScore } from "./fit-score.js";

export type NarrationEvent =
  | { type: "intent"; intent: TripIntent }
  | { type: "narrate"; message: string }
  | { type: "gap"; message: string }
  | { type: "present"; presentation: TripPresentation };

export type Narrate = (e: NarrationEvent) => void | Promise<void>;

export interface PipelineDeps {
  planner?: Planner;
  lodging: LodgingAdapter;
  air?: AirAdapter;
  forecast?: ForecastEngine;
  adapterTimeoutMs?: number;
}

export interface RunOptions {
  taste?: TastePrefs;
  now?: Date;
  narrate?: Narrate;
}

/** Intent → Parse → Fan-out → Score → Verdict → Present. */
export async function assembleTrip(
  intentText: string,
  deps: PipelineDeps,
  opts: RunOptions = {},
): Promise<TripPresentation> {
  const planner = deps.planner ?? new HeuristicPlanner();
  const forecast = deps.forecast ?? new HeuristicForecastEngine();
  const timeout = deps.adapterTimeoutMs ?? 8000;
  const emit = opts.narrate ?? (() => {});
  const now = opts.now ?? new Date();

  // 1. Parse
  const intent = await planner.parse(intentText, opts.taste, now);
  await emit({ type: "intent", intent });
  const city = intent.destinations[0]!;
  await emit({
    type: "narrate",
    message: `Understood: ${intent.nights ?? 3} nights in ${city}${
      intent.neighborhoods[0] ? `, near ${intent.neighborhoods[0]}` : ""
    }${intent.hotelStyle[0] ? `, ${intent.hotelStyle[0]}` : ""}.`,
  });

  const checkIn = intent.checkIn!;
  const checkOut = intent.checkOut!;
  const nights = intent.nights ?? 3;

  // 2. Fan-out (concurrent, per-adapter timeout, degrade gracefully)
  const gaps: string[] = [];
  await emit({ type: "narrate", message: `Searching suppliers for ${city}…` });

  const lodgingP = withTimeout(
    deps.lodging.search({
      city,
      checkIn,
      checkOut,
      nights,
      partySize: intent.partySize,
      neighborhoods: intent.neighborhoods,
      style: intent.hotelStyle,
      maxPerNightMinor: intent.budgetPerNightMinor,
      currency: intent.currency,
    }),
    timeout,
  ).catch((): NormalizedOffer[] => {
    gaps.push("Lodging adapter timed out; retrying is recommended.");
    return [];
  });

  const airP: Promise<NormalizedOffer[]> =
    intent.needsFlight && deps.air && intent.origin
      ? withTimeout(
          deps.air.search({
            origin: intent.origin,
            destination: city,
            departDate: checkIn,
            returnDate: checkOut,
            partySize: intent.partySize,
            currency: intent.currency,
          }),
          timeout,
        ).catch((): NormalizedOffer[] => {
          gaps.push("Air adapter unavailable — presenting hotel-only.");
          return [];
        })
      : Promise.resolve<NormalizedOffer[]>([]);

  const [hotels, flights] = await Promise.all([lodgingP, airP]);
  await emit({
    type: "narrate",
    message: `Found ${hotels.length} stays${flights.length ? ` and ${flights.length} fares` : ""}. Scoring by fit…`,
  });
  for (const g of gaps) await emit({ type: "gap", message: g });

  if (hotels.length === 0) {
    throw new Error(`No lodging available for ${city} on ${checkIn}.`);
  }

  // 3. Score (margin-blind)
  const scored = hotels
    .map((offer) => {
      const fitInput = buildFitInput(offer, intent, opts.taste);
      const breakdown = fitScore(fitInput);
      return { offer, breakdown };
    })
    .sort((a, b) => b.breakdown.score - a.breakdown.score);

  const bestFlight =
    flights.length > 0
      ? [...flights].sort(
          (a, b) => (b.scheduleQuality ?? 0) - (a.scheduleQuality ?? 0),
        )[0]!
      : null;

  // 4 + 5. Verdict + Assemble exactly 1 primary + up to 2 alternates
  const daysToDeparture = daysBetween(now, new Date(checkIn));
  const top = scored.slice(0, 3);
  const options: TripOption[] = top.map((s, i) => {
    const segments: AssembledSegment[] = [{ kind: "HOTEL", offer: s.offer }];
    let total: Money = s.offer.price;
    if (bestFlight) {
      segments.unshift({ kind: "FLIGHT", offer: bestFlight });
      total = addMoney(total, bestFlight.price);
    }
    const fc = forecast.forecast(s.offer, { daysToDeparture, now });
    return {
      id: `opt_${s.offer.id}`,
      rank: (i + 1) as 1 | 2 | 3,
      label: i === 0 ? "Best fit" : i === 1 ? "Alternate · value" : "Alternate · upgrade",
      segments,
      totalPrice: total,
      fitScore: s.breakdown.score,
      fitBreakdown: s.breakdown,
      forecast: fc,
      expiresAt: new Date(now.getTime() + 30 * 60_000).toISOString(),
    };
  });

  const clarifyingQuestion =
    intent.unresolved.includes("destination")
      ? "Which city should I plan for?"
      : null;

  const presentation: TripPresentation = {
    intentEcho: intentText,
    clarifyingQuestion,
    primary: options[0]!,
    alternates: options.slice(1, 3),
    gaps,
  };

  await emit({ type: "narrate", message: `Assembled 1 primary + ${presentation.alternates.length} alternates.` });
  await emit({ type: "present", presentation });
  return presentation;
}

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`adapter timeout after ${ms}ms`)), ms);
    p.then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      (e) => {
        clearTimeout(t);
        reject(e);
      },
    );
  });
}

function daysBetween(a: Date, b: Date): number {
  return Math.max(0, Math.round((b.getTime() - a.getTime()) / 86_400_000));
}
