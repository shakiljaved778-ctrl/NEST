/**
 * LABELED-MOCK air fares. Not real supplier data. Generated deterministically
 * to cover the 12 launch corridors with ≥200 fares total (~18 per corridor).
 */
export interface FareSeed {
  id: string;
  origin: string;
  destination: string;
  airline: string;
  departTime: string; // HH:MM local
  stops: number;
  durationMin: number;
  baseMinor: number; // round-trip, USD cents
  refundable: boolean;
  scheduleQuality: number; // 0..1
}

export const CORRIDORS: Array<[string, string]> = [
  ["NYC", "London"],
  ["Dubai", "Bombay"],
  ["Singapore", "Tokyo"],
  ["NYC", "Paris"],
  ["London", "Dubai"],
  ["Tokyo", "Singapore"],
  ["London", "Istanbul"],
  ["Dubai", "Singapore"],
  ["NYC", "Dubai"],
  ["Paris", "Tokyo"],
  ["Istanbul", "Dubai"],
  ["Singapore", "London"],
];

const AIRLINES = [
  "Voyara Air",
  "Atlas Skyways",
  "Meridian",
  "Northwind",
  "Azure Jet",
  "Cirrus",
];

const TIMES = ["06:15", "09:40", "13:05", "17:20", "21:40", "23:55"];

function hash(s: string): number {
  let h = 2166136261;
  for (const c of s) {
    h ^= c.charCodeAt(0);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

function buildFares(): FareSeed[] {
  const out: FareSeed[] = [];
  for (const [origin, destination] of CORRIDORS) {
    for (let i = 0; i < 18; i++) {
      const key = `${origin}-${destination}-${i}`;
      const h = hash(key);
      const airline = AIRLINES[h % AIRLINES.length]!;
      const departTime = TIMES[(h >> 3) % TIMES.length]!;
      const stops = (h >> 5) % 3 === 0 ? 1 : 0;
      const durationMin = 240 + ((h >> 7) % 700) + stops * 120;
      const baseMinor = 18000 + ((h >> 9) % 62000) + stops * -4000;
      const refundable = (h >> 11) % 3 !== 0;
      const scheduleQuality = Math.round((1 - stops * 0.25 - ((h >> 13) % 20) / 100) * 100) / 100;
      out.push({
        id: `air-${origin}-${destination}-${i}`.toLowerCase(),
        origin,
        destination,
        airline,
        departTime,
        stops,
        durationMin,
        baseMinor: Math.max(9900, baseMinor),
        refundable,
        scheduleQuality: Math.max(0.3, scheduleQuality),
      });
    }
  }
  return out;
}

export const FARES: FareSeed[] = buildFares();
