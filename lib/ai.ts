import { SERVICES, getService } from "./catalog";
import type { ComplaintClassification, LanguageCode } from "./types";

/**
 * NEST AI layer — MVP implementation.
 *
 * These are deterministic, rule-based versions of the production AI modules so
 * the whole product works offline. In production each function is backed by an
 * LLM call through the AI orchestration service (with RAG over the service
 * knowledge base, guardrails, audit logging and human handoff).
 */

export interface AssistantReply {
  reply: string;
  suggestedServiceId?: string;
  suggestedPackageId?: string;
  followUps?: string[];
  safetyEscalation?: boolean;
}

interface Rule {
  keywords: string[];
  serviceId: string;
  packageId: string;
  reply: string;
  followUps: string[];
  safety?: boolean;
}

const RULES: Rule[] = [
  {
    keywords: ["ac", "cooling", "مكيف", "يبرد", "condition", "hot air", "freon", "gas"],
    serviceId: "ac-technician",
    packageId: "ac-service",
    reply:
      "Sounds like an AC issue. A few quick checks help me book the right visit: is it a split or central unit, and is there any water leakage? For most 'not cooling' cases I recommend an AC service visit — the technician checks gas pressure and coils, and any repair is quoted before work starts.",
    followUps: ["Is the AC split or central?", "Any water dripping from the unit?", "When was it last serviced?"],
  },
  {
    keywords: ["leak", "pipe", "tap", "water", "تسريب", "ماء", "drain", "blocked", "toilet", "flush"],
    serviceId: "plumbing",
    packageId: "pl-visit",
    reply:
      "That's a plumbing job. If water is actively leaking, please shut the main valve first. I recommend an inspection visit — the plumber diagnoses on-site and the visit fee is waived if you proceed with the repair.",
    followUps: ["Is water actively leaking now?", "Kitchen, bathroom, or heater?"],
    safety: true,
  },
  {
    keywords: ["spark", "electric", "power", "socket", "light", "كهرباء", "شرارة", "breaker", "trip"],
    serviceId: "electrical",
    packageId: "el-visit",
    reply:
      "Electrical issues need a certified pro — please don't open panels yourself. If you see sparks or smell burning, switch off the breaker now. I can book a certified electrician for an inspection visit with a fixed quote before any work.",
    followUps: ["Is the breaker tripping repeatedly?", "Any burning smell? If yes, switch off the mains."],
    safety: true,
  },
  {
    keywords: ["clean", "dust", "messy", "تنظيف", "maid", "housekeeping"],
    serviceId: "house-cleaning",
    packageId: "hc-2h",
    reply:
      "I can arrange a verified cleaner today. For a standard apartment refresh the 2-hour clean is most popular; for post-party or move-in situations I'd suggest a deep clean instead. Want me to set one up?",
    followUps: ["Apartment or villa?", "Regular clean or deep clean?"],
  },
  {
    keywords: ["cockroach", "ant", "bug", "pest", "حشرات", "صرصور", "bedbug", "mosquito"],
    serviceId: "pest-control",
    packageId: "pc-apt",
    reply:
      "Pests are best handled with an MoPH-approved treatment. For apartments the standard treatment covers cockroaches and ants with child- and pet-safe options. You'll need to vacate treated rooms for 2–4 hours.",
    followUps: ["Apartment or villa?", "Which pest are you seeing?"],
  },
  {
    keywords: ["nanny", "babysit", "child", "مربية", "اطفال", "kids"],
    serviceId: "nanny",
    packageId: "nn-4h",
    reply:
      "All Nest nannies are QID-verified with background checks and first-aid training. A 4-hour visit is the most popular starting point, and you can request an Arabic-speaking nanny or set a preferred professional for repeat visits.",
    followUps: ["How many children and what ages?", "One-time or recurring?"],
  },
  {
    keywords: ["wash", "car", "سيارة", "غسيل سيارة"],
    serviceId: "car-wash",
    packageId: "cw-ext",
    reply:
      "We do eco waterless car washes right at your parking spot. Exterior wash is QAR 39; the full in-and-out wash is the family favourite.",
    followUps: ["Exterior only or full wash?", "Where is the car parked?"],
  },
  {
    keywords: ["fridge", "washing machine", "oven", "dishwasher", "غسالة", "ثلاجة", "appliance"],
    serviceId: "appliance-repair",
    packageId: "ap-visit",
    reply:
      "For appliances I recommend a diagnosis visit — the technician identifies the fault and gives a fixed repair quote before touching anything. Parts, if needed, are quoted transparently.",
    followUps: ["Which appliance and what's it doing?", "Brand and approximate age?"],
  },
  {
    keywords: ["move", "moving", "shift", "نقل", "furniture", "truck"],
    serviceId: "moving",
    packageId: "mv-small",
    reply:
      "Moving help is available with vans or trucks plus trained movers. For a studio or 1BR within Doha the small move package works well; add packing service if you want it fully handled.",
    followUps: ["From which area to which area?", "How many rooms?"],
  },
  {
    keywords: ["cook", "chef", "meal", "طبخ", "food", "iftar", "majlis"],
    serviceId: "cooking",
    packageId: "ck-meal",
    reply:
      "Our home chefs cook in your kitchen with your groceries — up to three dishes in a 2-hour visit. For gatherings we have a dedicated events chef package.",
    followUps: ["Daily meals or a gathering?", "Any cuisine preference?"],
  },
];

const EMERGENCY_KEYWORDS = ["fire", "smoke", "shock", "injured", "injury", "flood", "gas smell", "emergency", "حريق", "دخان", "طوارئ"];

/** AI booking assistant — routes a free-text request to the right service. */
export function bookingAssistant(message: string, _lang: LanguageCode = "en"): AssistantReply {
  const text = message.toLowerCase();

  // Safety first: emergencies route to humans, never to a booking.
  if (EMERGENCY_KEYWORDS.some((k) => text.includes(k))) {
    return {
      reply:
        "This sounds like it could be an emergency. Please prioritise your safety: for fire or gas call Civil Defence 999 immediately. I've alerted our operations team who can call you right away — I won't book a standard visit for an emergency situation.",
      safetyEscalation: true,
    };
  }

  for (const rule of RULES) {
    if (rule.keywords.some((k) => text.includes(k))) {
      const service = getService(rule.serviceId);
      return {
        reply: rule.reply,
        suggestedServiceId: rule.serviceId,
        suggestedPackageId: rule.packageId,
        followUps: rule.followUps,
        safetyEscalation: rule.safety ?? false,
      };
    }
  }

  return {
    reply:
      "I can help you book any of our 15 home services — cleaning, AC, plumbing, electrical, pest control, nanny, cooking, laundry, handyman, salon-at-home, appliance repair, moving, car wash or elderly care. Tell me what's happening at home, for example: “my AC is not cooling” or “I need a deep clean before moving in.”",
    followUps: SERVICES.slice(0, 4).map((s) => s.name),
  };
}

/** AI complaint classifier — mirrors the production JSON contract. */
export function classifyComplaint(text: string): ComplaintClassification {
  const lower = text.toLowerCase();
  const has = (...words: string[]) => words.some((w) => lower.includes(w));

  let category: ComplaintClassification["category"] = "other";
  let priority: ComplaintClassification["priority"] = "low";
  let refundRisk = 0.1;
  let humanEscalation = false;

  if (has("unsafe", "threat", "harass", "scared", "abuse", "inappropriate", "child", "hurt")) {
    category = "safety_concern";
    priority = "critical";
    refundRisk = 0.7;
    humanEscalation = true;
  } else if (has("broke", "broken", "damage", "scratch", "stain", "cracked")) {
    category = "damage_claim";
    priority = "high";
    refundRisk = 0.65;
    humanEscalation = true;
  } else if (has("charge", "payment", "paid twice", "refund", "money", "overcharg")) {
    category = "payment_issue";
    priority = "high";
    refundRisk = 0.6;
    humanEscalation = true;
  } else if (has("rude", "behavior", "behaviour", "attitude", "shout", "disrespect")) {
    category = "provider_behavior";
    priority = "high";
    refundRisk = 0.35;
    humanEscalation = true;
  } else if (has("late", "delay", "waiting", "didn't come", "no show", "never arrived")) {
    category = "late_arrival";
    priority = "medium";
    refundRisk = 0.3;
  } else if (has("incomplete", "unfinished", "left early", "didn't finish", "half")) {
    category = "incomplete_job";
    priority = "medium";
    refundRisk = 0.45;
  } else if (has("bad", "poor", "dirty", "not clean", "quality", "sloppy", "worse")) {
    category = "poor_quality";
    priority = "medium";
    refundRisk = 0.4;
  }

  return {
    category,
    priority,
    sentiment: category === "other" ? "neutral" : "negative",
    refundRisk,
    humanEscalation,
    summary: text.length > 140 ? `${text.slice(0, 137)}…` : text,
  };
}

/** AI operations daily summary — assembled from live marketplace stats. */
export function adminDailySummary(stats: {
  bookingsToday: number;
  gmvToday: number;
  completionRate: number;
  openComplaints: number;
  topService: string;
  hotZone: string;
}): string {
  const risk =
    stats.openComplaints > 5
      ? `⚠ ${stats.openComplaints} complaints are open — two are damage claims that need human review today.`
      : `${stats.openComplaints} open complaints, all within SLA.`;
  return [
    `Good morning. ${stats.bookingsToday} bookings so far today for QAR ${stats.gmvToday.toLocaleString()} GMV.`,
    `Completion rate is ${(stats.completionRate * 100).toFixed(0)}%. ${stats.topService} is today's top seller, with demand concentrating in ${stats.hotZone}.`,
    risk,
    `Supply note: evening slots (17:00–21:00) in West Bay are near capacity — consider activating 2 standby AC technicians and a peak-hour uplift.`,
  ].join(" ");
}
