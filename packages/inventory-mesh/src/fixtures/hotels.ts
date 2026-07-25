/**
 * Rich, LABELED-MOCK lodging fixtures. Not real supplier data.
 * ≥50 hotels across 6 launch cities. Nightly rates are integer minor units (USD cents).
 */
export interface HotelSeed {
  id: string;
  city: string;
  anchor: string;
  name: string;
  neighborhood: string;
  style: string[];
  rating: number;
  reviewCount: number;
  nightlyMinor: number;
  amenities: string[];
  distanceToAnchorKm: number;
  refundable: boolean;
}

export const CITY_ANCHORS: Record<string, string> = {
  Istanbul: "Sultanahmet",
  London: "Covent Garden",
  Dubai: "Downtown Dubai",
  Tokyo: "Shinjuku",
  Singapore: "Marina Bay",
  "New York": "Midtown",
};

const A = "wifi";
const B = "breakfast";
const P = "pool";
const S = "spa";
const G = "gym";
const R = "rooftop";
const F = "family-room";

export const HOTELS: HotelSeed[] = [
  // ── Istanbul (boutique-heavy, Sultanahmet focus for the exit test) ──
  { id: "ist-01", city: "Istanbul", anchor: "Sultanahmet", name: "Hagia Court Boutique", neighborhood: "Sultanahmet", style: ["boutique", "design"], rating: 4.7, reviewCount: 812, nightlyMinor: 11800, amenities: [A, B, R], distanceToAnchorKm: 0.3, refundable: true },
  { id: "ist-02", city: "Istanbul", anchor: "Sultanahmet", name: "Blue Mosque House", neighborhood: "Sultanahmet", style: ["boutique"], rating: 4.6, reviewCount: 540, nightlyMinor: 9900, amenities: [A, B], distanceToAnchorKm: 0.2, refundable: true },
  { id: "ist-03", city: "Istanbul", anchor: "Sultanahmet", name: "Cistern Lofts", neighborhood: "Sultanahmet", style: ["boutique", "design"], rating: 4.8, reviewCount: 1203, nightlyMinor: 13400, amenities: [A, B, R, G], distanceToAnchorKm: 0.5, refundable: true },
  { id: "ist-04", city: "Istanbul", anchor: "Sultanahmet", name: "Bosphorus Boutique Karaköy", neighborhood: "Karaköy", style: ["boutique", "design"], rating: 4.5, reviewCount: 690, nightlyMinor: 12600, amenities: [A, R], distanceToAnchorKm: 2.4, refundable: true },
  { id: "ist-05", city: "Istanbul", anchor: "Sultanahmet", name: "Grand Bazaar Konak", neighborhood: "Beyazıt", style: ["boutique"], rating: 4.3, reviewCount: 410, nightlyMinor: 8700, amenities: [A, B], distanceToAnchorKm: 1.1, refundable: true },
  { id: "ist-06", city: "Istanbul", anchor: "Sultanahmet", name: "Pera Palace Legacy", neighborhood: "Beyoğlu", style: ["luxury"], rating: 4.8, reviewCount: 2210, nightlyMinor: 28900, amenities: [A, B, S, G, R], distanceToAnchorKm: 3.2, refundable: false },
  { id: "ist-07", city: "Istanbul", anchor: "Sultanahmet", name: "Taksim Design Suites", neighborhood: "Taksim", style: ["design", "business"], rating: 4.4, reviewCount: 980, nightlyMinor: 10400, amenities: [A, G], distanceToAnchorKm: 3.8, refundable: true },
  { id: "ist-08", city: "Istanbul", anchor: "Sultanahmet", name: "Sultanahmet Family Konak", neighborhood: "Sultanahmet", style: ["boutique"], rating: 4.2, reviewCount: 355, nightlyMinor: 9400, amenities: [A, B, F], distanceToAnchorKm: 0.6, refundable: true },
  { id: "ist-09", city: "Istanbul", anchor: "Sultanahmet", name: "Golden Horn Budget Inn", neighborhood: "Fatih", style: ["budget"], rating: 4.0, reviewCount: 220, nightlyMinor: 5200, amenities: [A], distanceToAnchorKm: 1.6, refundable: true },
  { id: "ist-10", city: "Istanbul", anchor: "Sultanahmet", name: "Ortaköy Waterside Resort", neighborhood: "Ortaköy", style: ["resort", "luxury"], rating: 4.6, reviewCount: 1440, nightlyMinor: 24500, amenities: [A, B, P, S, G], distanceToAnchorKm: 6.1, refundable: false },

  // ── London ──
  { id: "lon-01", city: "London", anchor: "Covent Garden", name: "Seven Dials Boutique", neighborhood: "Covent Garden", style: ["boutique", "design"], rating: 4.6, reviewCount: 1520, nightlyMinor: 27800, amenities: [A, B], distanceToAnchorKm: 0.3, refundable: true },
  { id: "lon-02", city: "London", anchor: "Covent Garden", name: "Soho Sessions Hotel", neighborhood: "Soho", style: ["design", "boutique"], rating: 4.5, reviewCount: 2210, nightlyMinor: 31200, amenities: [A, R, G], distanceToAnchorKm: 0.9, refundable: true },
  { id: "lon-03", city: "London", anchor: "Covent Garden", name: "Bloomsbury Reading Rooms", neighborhood: "Bloomsbury", style: ["boutique"], rating: 4.4, reviewCount: 870, nightlyMinor: 21900, amenities: [A, B], distanceToAnchorKm: 1.4, refundable: true },
  { id: "lon-04", city: "London", anchor: "Covent Garden", name: "The Mayfair Grand", neighborhood: "Mayfair", style: ["luxury"], rating: 4.9, reviewCount: 3400, nightlyMinor: 62000, amenities: [A, B, S, G], distanceToAnchorKm: 1.8, refundable: false },
  { id: "lon-05", city: "London", anchor: "Covent Garden", name: "Shoreditch Works", neighborhood: "Shoreditch", style: ["design", "business"], rating: 4.3, reviewCount: 1290, nightlyMinor: 18700, amenities: [A, G, R], distanceToAnchorKm: 3.9, refundable: true },
  { id: "lon-06", city: "London", anchor: "Covent Garden", name: "Kensington Garden Rooms", neighborhood: "Kensington", style: ["boutique", "luxury"], rating: 4.6, reviewCount: 1610, nightlyMinor: 34500, amenities: [A, B, S], distanceToAnchorKm: 4.2, refundable: true },
  { id: "lon-07", city: "London", anchor: "Covent Garden", name: "Paddington Value Stay", neighborhood: "Paddington", style: ["budget"], rating: 4.0, reviewCount: 640, nightlyMinor: 11200, amenities: [A], distanceToAnchorKm: 3.1, refundable: true },
  { id: "lon-08", city: "London", anchor: "Covent Garden", name: "Southbank Family Suites", neighborhood: "Southbank", style: ["business"], rating: 4.2, reviewCount: 980, nightlyMinor: 19900, amenities: [A, F, G], distanceToAnchorKm: 1.2, refundable: true },
  { id: "lon-09", city: "London", anchor: "Covent Garden", name: "Notting Hill Pastel House", neighborhood: "Notting Hill", style: ["boutique", "design"], rating: 4.5, reviewCount: 1120, nightlyMinor: 25600, amenities: [A, B], distanceToAnchorKm: 5.0, refundable: true },

  // ── Dubai ──
  { id: "dxb-01", city: "Dubai", anchor: "Downtown Dubai", name: "Burj View Boutique", neighborhood: "Downtown Dubai", style: ["design", "luxury"], rating: 4.7, reviewCount: 2040, nightlyMinor: 29900, amenities: [A, B, P, G], distanceToAnchorKm: 0.4, refundable: true },
  { id: "dxb-02", city: "Dubai", anchor: "Downtown Dubai", name: "DIFC Business Tower", neighborhood: "DIFC", style: ["business"], rating: 4.5, reviewCount: 1330, nightlyMinor: 22400, amenities: [A, G], distanceToAnchorKm: 1.7, refundable: true },
  { id: "dxb-03", city: "Dubai", anchor: "Downtown Dubai", name: "Marina Walk Resort", neighborhood: "Dubai Marina", style: ["resort", "luxury"], rating: 4.8, reviewCount: 3900, nightlyMinor: 41200, amenities: [A, B, P, S, G, R], distanceToAnchorKm: 12.5, refundable: false },
  { id: "dxb-04", city: "Dubai", anchor: "Downtown Dubai", name: "Jumeirah Beach Villas", neighborhood: "Jumeirah", style: ["resort", "luxury"], rating: 4.9, reviewCount: 5100, nightlyMinor: 58000, amenities: [A, B, P, S], distanceToAnchorKm: 9.0, refundable: false },
  { id: "dxb-05", city: "Dubai", anchor: "Downtown Dubai", name: "Deira Heritage Boutique", neighborhood: "Deira", style: ["boutique"], rating: 4.2, reviewCount: 560, nightlyMinor: 12800, amenities: [A, B], distanceToAnchorKm: 6.2, refundable: true },
  { id: "dxb-06", city: "Dubai", anchor: "Downtown Dubai", name: "Business Bay Smart Suites", neighborhood: "Business Bay", style: ["design", "business"], rating: 4.4, reviewCount: 1470, nightlyMinor: 19900, amenities: [A, G, P], distanceToAnchorKm: 2.3, refundable: true },
  { id: "dxb-07", city: "Dubai", anchor: "Downtown Dubai", name: "Al Barsha Value Inn", neighborhood: "Al Barsha", style: ["budget"], rating: 4.0, reviewCount: 430, nightlyMinor: 8900, amenities: [A], distanceToAnchorKm: 11.0, refundable: true },
  { id: "dxb-08", city: "Dubai", anchor: "Downtown Dubai", name: "Palm Family Resort", neighborhood: "Palm Jumeirah", style: ["resort"], rating: 4.6, reviewCount: 2600, nightlyMinor: 47000, amenities: [A, B, P, F], distanceToAnchorKm: 16.0, refundable: false },
  { id: "dxb-09", city: "Dubai", anchor: "Downtown Dubai", name: "Old Town Courtyard", neighborhood: "Downtown Dubai", style: ["boutique", "design"], rating: 4.5, reviewCount: 990, nightlyMinor: 24900, amenities: [A, B, P], distanceToAnchorKm: 0.7, refundable: true },

  // ── Tokyo ──
  { id: "tyo-01", city: "Tokyo", anchor: "Shinjuku", name: "Shinjuku Lantern Boutique", neighborhood: "Shinjuku", style: ["boutique", "design"], rating: 4.6, reviewCount: 1780, nightlyMinor: 18900, amenities: [A, B], distanceToAnchorKm: 0.4, refundable: true },
  { id: "tyo-02", city: "Tokyo", anchor: "Shinjuku", name: "Shibuya Crossing Loft", neighborhood: "Shibuya", style: ["design"], rating: 4.5, reviewCount: 2210, nightlyMinor: 21200, amenities: [A, G], distanceToAnchorKm: 3.4, refundable: true },
  { id: "tyo-03", city: "Tokyo", anchor: "Shinjuku", name: "Ginza Silk Ryokan", neighborhood: "Ginza", style: ["luxury", "boutique"], rating: 4.9, reviewCount: 1450, nightlyMinor: 46000, amenities: [A, B, S], distanceToAnchorKm: 6.1, refundable: false },
  { id: "tyo-04", city: "Tokyo", anchor: "Shinjuku", name: "Asakusa Riverside Inn", neighborhood: "Asakusa", style: ["boutique"], rating: 4.3, reviewCount: 720, nightlyMinor: 11200, amenities: [A, B], distanceToAnchorKm: 8.2, refundable: true },
  { id: "tyo-05", city: "Tokyo", anchor: "Shinjuku", name: "Roppongi Tower Suites", neighborhood: "Roppongi", style: ["business", "luxury"], rating: 4.6, reviewCount: 1980, nightlyMinor: 32800, amenities: [A, G, S], distanceToAnchorKm: 4.9, refundable: true },
  { id: "tyo-06", city: "Tokyo", anchor: "Shinjuku", name: "Ueno Park Value Stay", neighborhood: "Ueno", style: ["budget"], rating: 4.1, reviewCount: 510, nightlyMinor: 7600, amenities: [A], distanceToAnchorKm: 7.0, refundable: true },
  { id: "tyo-07", city: "Tokyo", anchor: "Shinjuku", name: "Shinjuku Family Capsule Plus", neighborhood: "Shinjuku", style: ["design"], rating: 4.2, reviewCount: 860, nightlyMinor: 9800, amenities: [A, F], distanceToAnchorKm: 0.8, refundable: true },
  { id: "tyo-08", city: "Tokyo", anchor: "Shinjuku", name: "Nakameguro Canal House", neighborhood: "Nakameguro", style: ["boutique", "design"], rating: 4.7, reviewCount: 640, nightlyMinor: 20400, amenities: [A, B], distanceToAnchorKm: 5.3, refundable: true },
  { id: "tyo-09", city: "Tokyo", anchor: "Shinjuku", name: "Marunouchi Grand", neighborhood: "Marunouchi", style: ["luxury", "business"], rating: 4.8, reviewCount: 2600, nightlyMinor: 41000, amenities: [A, B, G, S], distanceToAnchorKm: 6.6, refundable: false },

  // ── Singapore ──
  { id: "sin-01", city: "Singapore", anchor: "Marina Bay", name: "Marina Bay Skydeck", neighborhood: "Marina Bay", style: ["luxury", "design"], rating: 4.8, reviewCount: 4100, nightlyMinor: 39900, amenities: [A, B, P, G, R], distanceToAnchorKm: 0.3, refundable: false },
  { id: "sin-02", city: "Singapore", anchor: "Marina Bay", name: "Chinatown Shophouse Boutique", neighborhood: "Chinatown", style: ["boutique", "design"], rating: 4.5, reviewCount: 1320, nightlyMinor: 16800, amenities: [A, B], distanceToAnchorKm: 2.1, refundable: true },
  { id: "sin-03", city: "Singapore", anchor: "Marina Bay", name: "Clarke Quay Riverloft", neighborhood: "Clarke Quay", style: ["design"], rating: 4.4, reviewCount: 1580, nightlyMinor: 18900, amenities: [A, P, G], distanceToAnchorKm: 1.6, refundable: true },
  { id: "sin-04", city: "Singapore", anchor: "Marina Bay", name: "Orchard Road Grand", neighborhood: "Orchard", style: ["luxury", "business"], rating: 4.7, reviewCount: 2900, nightlyMinor: 30200, amenities: [A, B, S, G], distanceToAnchorKm: 3.4, refundable: true },
  { id: "sin-05", city: "Singapore", anchor: "Marina Bay", name: "Kampong Glam Colours", neighborhood: "Kampong Glam", style: ["boutique"], rating: 4.3, reviewCount: 740, nightlyMinor: 13400, amenities: [A, B], distanceToAnchorKm: 2.9, refundable: true },
  { id: "sin-06", city: "Singapore", anchor: "Marina Bay", name: "Sentosa Cove Resort", neighborhood: "Sentosa", style: ["resort", "family"], rating: 4.6, reviewCount: 3300, nightlyMinor: 34800, amenities: [A, B, P, F], distanceToAnchorKm: 6.8, refundable: false },
  { id: "sin-07", city: "Singapore", anchor: "Marina Bay", name: "Bugis Value Pods", neighborhood: "Bugis", style: ["budget"], rating: 4.1, reviewCount: 620, nightlyMinor: 9200, amenities: [A], distanceToAnchorKm: 2.2, refundable: true },
  { id: "sin-08", city: "Singapore", anchor: "Marina Bay", name: "Tanjong Pagar Business Tower", neighborhood: "Tanjong Pagar", style: ["business"], rating: 4.4, reviewCount: 1210, nightlyMinor: 20600, amenities: [A, G], distanceToAnchorKm: 1.9, refundable: true },
  { id: "sin-09", city: "Singapore", anchor: "Marina Bay", name: "Katong Peranakan House", neighborhood: "Katong", style: ["boutique", "design"], rating: 4.5, reviewCount: 560, nightlyMinor: 15600, amenities: [A, B], distanceToAnchorKm: 7.4, refundable: true },

  // ── New York ──
  { id: "nyc-01", city: "New York", anchor: "Midtown", name: "Bryant Park Boutique", neighborhood: "Midtown", style: ["boutique", "design"], rating: 4.5, reviewCount: 2600, nightlyMinor: 33900, amenities: [A, G], distanceToAnchorKm: 0.4, refundable: true },
  { id: "nyc-02", city: "New York", anchor: "Midtown", name: "SoHo Cast Iron Loft", neighborhood: "SoHo", style: ["design", "boutique"], rating: 4.6, reviewCount: 1980, nightlyMinor: 37800, amenities: [A, R], distanceToAnchorKm: 4.5, refundable: true },
  { id: "nyc-03", city: "New York", anchor: "Midtown", name: "West Village Brownstone", neighborhood: "West Village", style: ["boutique"], rating: 4.7, reviewCount: 1240, nightlyMinor: 41200, amenities: [A, B], distanceToAnchorKm: 5.1, refundable: true },
  { id: "nyc-04", city: "New York", anchor: "Midtown", name: "Tribeca Grand Suites", neighborhood: "Tribeca", style: ["luxury", "business"], rating: 4.8, reviewCount: 3100, nightlyMinor: 52000, amenities: [A, S, G], distanceToAnchorKm: 6.0, refundable: false },
  { id: "nyc-05", city: "New York", anchor: "Midtown", name: "Williamsburg Warehouse", neighborhood: "Williamsburg", style: ["design"], rating: 4.4, reviewCount: 1670, nightlyMinor: 24900, amenities: [A, R, G], distanceToAnchorKm: 6.9, refundable: true },
  { id: "nyc-06", city: "New York", anchor: "Midtown", name: "Upper West Family Residence", neighborhood: "Upper West Side", style: ["business"], rating: 4.3, reviewCount: 1420, nightlyMinor: 28700, amenities: [A, F], distanceToAnchorKm: 4.2, refundable: true },
  { id: "nyc-07", city: "New York", anchor: "Midtown", name: "Harlem Jazz House", neighborhood: "Harlem", style: ["boutique", "budget"], rating: 4.1, reviewCount: 540, nightlyMinor: 15900, amenities: [A, B], distanceToAnchorKm: 8.3, refundable: true },
  { id: "nyc-08", city: "New York", anchor: "Midtown", name: "Financial District Tower", neighborhood: "FiDi", style: ["business", "luxury"], rating: 4.5, reviewCount: 2210, nightlyMinor: 31200, amenities: [A, G, S], distanceToAnchorKm: 7.0, refundable: true },
  { id: "nyc-09", city: "New York", anchor: "Midtown", name: "Chelsea Gallery Rooms", neighborhood: "Chelsea", style: ["design", "boutique"], rating: 4.6, reviewCount: 1310, nightlyMinor: 34600, amenities: [A, R], distanceToAnchorKm: 2.6, refundable: true },
];
