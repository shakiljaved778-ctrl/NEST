/** Shared domain types for the NEST Solutions super app. */

export type LanguageCode = "en" | "ar" | "hi" | "ur" | "ml" | "tl";

export type ZoneId =
  | "west-bay"
  | "the-pearl"
  | "lusail"
  | "al-sadd"
  | "al-rayyan"
  | "al-wakrah"
  | "msheireb"
  | "al-khor";

export interface Zone {
  id: ZoneId;
  name: string;
  nameAr: string;
  /** Launch wave from the go-to-market plan: 1 = beachhead, 2 = expansion. */
  wave: 1 | 2;
}

export interface ServicePackage {
  id: string;
  name: string;
  nameAr: string;
  description: string;
  /** Base price in QAR. */
  price: number;
  /** Duration in minutes. */
  duration: number;
  popular?: boolean;
}

export interface ServiceAddon {
  id: string;
  name: string;
  nameAr: string;
  price: number;
  duration: number;
}

export interface Service {
  id: string;
  icon: string;
  name: string;
  nameAr: string;
  tagline: string;
  /** Card accent used across the apps: alternating navy / teal / gold like the deck. */
  accent: "navy" | "teal" | "gold";
  packages: ServicePackage[];
  addons: ServiceAddon[];
  genderPreference: boolean;
  safetyNote?: string;
}

export interface Provider {
  id: string;
  name: string;
  avatarInitials: string;
  gender: "male" | "female";
  rating: number;
  jobsDone: number;
  completionRate: number;
  responseMinutes: number;
  skills: string[]; // service ids
  zones: ZoneId[];
  languages: LanguageCode[];
  verified: boolean;
  yearsExperience: number;
}

export type BookingStatus =
  | "pending_match"
  | "matched"
  | "accepted"
  | "en_route"
  | "arrived"
  | "in_progress"
  | "completed"
  | "cancelled";

export interface QuoteLine {
  label: string;
  amount: number;
}

export interface Quote {
  lines: QuoteLine[];
  subtotal: number;
  discount: number;
  surcharge: number;
  total: number;
  currency: "QAR";
  slotLabel: string;
  peak: boolean;
}

export interface Booking {
  id: string;
  serviceId: string;
  packageId: string;
  addonIds: string[];
  zoneId: ZoneId;
  address: string;
  date: string; // ISO date
  slot: string; // e.g. "16:00"
  urgent: boolean;
  couponCode?: string;
  paymentMethod: string;
  quote: Quote;
  providerId?: string;
  status: BookingStatus;
  customerName: string;
  language: LanguageCode;
  rating?: number;
  createdAt: string;
}

export interface MatchResult {
  provider: Provider;
  score: number;
  breakdown: Record<string, number>;
}

export interface ComplaintClassification {
  category:
    | "late_arrival"
    | "poor_quality"
    | "damage_claim"
    | "safety_concern"
    | "payment_issue"
    | "provider_behavior"
    | "incomplete_job"
    | "other";
  priority: "low" | "medium" | "high" | "critical";
  sentiment: "negative" | "neutral" | "positive";
  refundRisk: number;
  humanEscalation: boolean;
  summary: string;
}
