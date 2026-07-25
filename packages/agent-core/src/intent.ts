import { type TripIntent, type TastePrefs } from "@voyara/contracts";
import { CITY_ANCHORS, HOTELS } from "@voyara/inventory-mesh";

const KNOWN_CITIES = Object.keys(CITY_ANCHORS);
const KNOWN_NEIGHBORHOODS = Array.from(
  new Set(HOTELS.map((h) => h.neighborhood)),
);
const STYLES = ["boutique", "luxury", "business", "budget", "design", "resort"];

/**
 * Parse one sentence of intent into a structured TripIntent. Ambiguity is
 * resolved using the taste graph first; only a truly unresolvable REQUIRED
 * field becomes a single clarifying question (recorded in `unresolved`).
 *
 * This is the deterministic parser used with the HeuristicPlanner. A
 * Planner backed by an LLM can produce the same TripIntent shape.
 */
export function parseIntent(
  raw: string,
  taste?: TastePrefs,
  now: Date = new Date(),
): TripIntent {
  const text = raw.toLowerCase();

  const destinations = KNOWN_CITIES.filter((c) =>
    text.includes(c.toLowerCase()),
  );

  const neighborhoods = KNOWN_NEIGHBORHOODS.filter((n) =>
    text.includes(n.toLowerCase()),
  );

  const hotelStyle = STYLES.filter((s) => text.includes(s));

  const nights = parseNights(text);
  const partySize = parseParty(text);
  const { checkIn, checkOut, resolvedNights } = parseDates(text, nights, now);
  const budgetPerNightMinor = parsePerNight(text);
  const budgetCapMinor = parseTotalBudget(text);

  const unresolved: string[] = [];
  if (destinations.length === 0) unresolved.push("destination");

  // Merge taste-graph defaults where the sentence was silent.
  const mergedStyle =
    hotelStyle.length > 0 ? hotelStyle : taste?.hotelStyle ?? [];
  const mergedNeighborhoods =
    neighborhoods.length > 0 ? neighborhoods : taste?.neighborhoods ?? [];

  return {
    raw,
    origin: null,
    destinations: destinations.length > 0 ? destinations : ["Istanbul"],
    checkIn,
    checkOut,
    nights: resolvedNights,
    partySize,
    budgetPerNightMinor,
    budgetCapMinor,
    currency: "USD",
    hotelStyle: mergedStyle,
    neighborhoods: mergedNeighborhoods,
    needsFlight: /\bflight|fly|flights\b/.test(text),
    unresolved,
  };
}

function parseNights(text: string): number | null {
  const m = text.match(/(\d+)\s*(?:nights?|nts?)/);
  if (m) return parseInt(m[1]!, 10);
  const words: Record<string, number> = {
    one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7,
  };
  const wm = text.match(/\b(one|two|three|four|five|six|seven)\b\s*nights?/);
  if (wm) return words[wm[1]!] ?? null;
  return null;
}

function parseParty(text: string): number {
  const m = text.match(/(\d+)\s*(?:people|guests?|adults?|travell?ers?|pax)/);
  if (m) return parseInt(m[1]!, 10);
  if (/\bcouple\b/.test(text)) return 2;
  if (/\bsolo\b/.test(text)) return 1;
  return 1;
}

function parsePerNight(text: string): number | null {
  // "under $150/night", "below 150 a night", "$150 per night"
  const m = text.match(
    /(?:under|below|<|max|up to)?\s*\$?\s*(\d{2,5})\s*(?:\/|\s*(?:a|per)\s*)night/,
  );
  if (m) return parseInt(m[1]!, 10) * 100;
  return null;
}

function parseTotalBudget(text: string): number | null {
  const m = text.match(/(?:total\s+budget|budget\s+of|under)\s*\$?\s*(\d{3,6})\b(?!\s*(?:\/|a|per)\s*night)/);
  if (m) return parseInt(m[1]!, 10) * 100;
  return null;
}

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}
function addDays(d: Date, n: number): Date {
  const c = new Date(d);
  c.setUTCDate(c.getUTCDate() + n);
  return c;
}

/** Resolve relative date phrases to concrete check-in/out. */
function parseDates(
  text: string,
  nights: number | null,
  now: Date,
): { checkIn: string | null; checkOut: string | null; resolvedNights: number | null } {
  let start: Date | null = null;
  const dow = now.getUTCDay(); // 0 Sun .. 6 Sat

  if (/next weekend/.test(text)) {
    // Friday of next week
    const daysToFri = ((5 - dow + 7) % 7) + 7;
    start = addDays(now, daysToFri);
  } else if (/this weekend|the weekend/.test(text)) {
    const daysToFri = (5 - dow + 7) % 7;
    start = addDays(now, daysToFri === 0 ? 0 : daysToFri);
  } else if (/next week/.test(text)) {
    start = addDays(now, ((1 - dow + 7) % 7) + 7);
  } else if (/tomorrow/.test(text)) {
    start = addDays(now, 1);
  } else if (/tonight|today/.test(text)) {
    start = now;
  }

  const n = nights ?? (/weekend/.test(text) ? 2 : null);

  if (start && n) {
    return {
      checkIn: isoDate(start),
      checkOut: isoDate(addDays(start, n)),
      resolvedNights: n,
    };
  }
  // Default when unspecified: 21 days out, 3 nights — a sensible stated default.
  const fallbackStart = start ?? addDays(now, 21);
  const fallbackNights = n ?? 3;
  return {
    checkIn: isoDate(fallbackStart),
    checkOut: isoDate(addDays(fallbackStart, fallbackNights)),
    resolvedNights: fallbackNights,
  };
}
