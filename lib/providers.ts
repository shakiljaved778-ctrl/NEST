import type { LanguageCode, MatchResult, Provider, ZoneId } from "./types";

/** Seed provider network (the pilot targets 40–60 verified providers across 2 zones). */
export const PROVIDERS: Provider[] = [
  { id: "p1", name: "Ramesh Kumar", avatarInitials: "RK", gender: "male", rating: 4.9, jobsDone: 412, completionRate: 0.98, responseMinutes: 4, skills: ["ac-technician", "appliance-repair", "electrical"], zones: ["west-bay", "al-sadd", "msheireb"], languages: ["en", "hi", "ml"], verified: true, yearsExperience: 8 },
  { id: "p2", name: "Maria Santos", avatarInitials: "MS", gender: "female", rating: 4.8, jobsDone: 356, completionRate: 0.97, responseMinutes: 6, skills: ["house-cleaning", "deep-cleaning", "laundry"], zones: ["the-pearl", "lusail", "west-bay"], languages: ["en", "tl"], verified: true, yearsExperience: 6 },
  { id: "p3", name: "Ahmed Hassan", avatarInitials: "AH", gender: "male", rating: 4.7, jobsDone: 289, completionRate: 0.95, responseMinutes: 7, skills: ["plumbing", "handyman", "electrical"], zones: ["al-rayyan", "al-sadd", "msheireb"], languages: ["ar", "en"], verified: true, yearsExperience: 11 },
  { id: "p4", name: "Priya Nair", avatarInitials: "PN", gender: "female", rating: 5.0, jobsDone: 198, completionRate: 0.99, responseMinutes: 3, skills: ["nanny", "elderly-care", "cooking"], zones: ["the-pearl", "west-bay", "lusail"], languages: ["en", "ml", "hi"], verified: true, yearsExperience: 9 },
  { id: "p5", name: "Jomar Reyes", avatarInitials: "JR", gender: "male", rating: 4.6, jobsDone: 274, completionRate: 0.93, responseMinutes: 9, skills: ["car-wash", "handyman", "moving"], zones: ["lusail", "al-khor", "west-bay"], languages: ["en", "tl"], verified: true, yearsExperience: 4 },
  { id: "p6", name: "Fatima Al-Sayed", avatarInitials: "FS", gender: "female", rating: 4.9, jobsDone: 321, completionRate: 0.98, responseMinutes: 5, skills: ["salon", "house-cleaning"], zones: ["west-bay", "the-pearl", "al-sadd"], languages: ["ar", "en"], verified: true, yearsExperience: 7 },
  { id: "p7", name: "Suresh Pillai", avatarInitials: "SP", gender: "male", rating: 4.8, jobsDone: 445, completionRate: 0.96, responseMinutes: 5, skills: ["ac-technician", "pest-control", "plumbing"], zones: ["al-wakrah", "al-sadd", "msheireb"], languages: ["en", "ml", "hi"], verified: true, yearsExperience: 12 },
  { id: "p8", name: "Ayesha Khan", avatarInitials: "AK", gender: "female", rating: 4.7, jobsDone: 167, completionRate: 0.94, responseMinutes: 8, skills: ["cooking", "house-cleaning", "laundry"], zones: ["al-rayyan", "al-sadd"], languages: ["ur", "en", "hi"], verified: true, yearsExperience: 5 },
  { id: "p9", name: "John Dela Cruz", avatarInitials: "JD", gender: "male", rating: 4.5, jobsDone: 203, completionRate: 0.92, responseMinutes: 11, skills: ["deep-cleaning", "pest-control", "moving"], zones: ["lusail", "the-pearl", "al-khor"], languages: ["en", "tl"], verified: true, yearsExperience: 3 },
  { id: "p10", name: "Mohammed Farooq", avatarInitials: "MF", gender: "male", rating: 4.8, jobsDone: 388, completionRate: 0.97, responseMinutes: 4, skills: ["electrical", "handyman", "appliance-repair"], zones: ["west-bay", "msheireb", "al-sadd"], languages: ["ur", "ar", "en"], verified: true, yearsExperience: 10 },
  { id: "p11", name: "Grace Villanueva", avatarInitials: "GV", gender: "female", rating: 4.9, jobsDone: 251, completionRate: 0.98, responseMinutes: 4, skills: ["nanny", "elderly-care"], zones: ["lusail", "the-pearl"], languages: ["en", "tl"], verified: true, yearsExperience: 8 },
  { id: "p12", name: "Vinod Thomas", avatarInitials: "VT", gender: "male", rating: 4.6, jobsDone: 312, completionRate: 0.95, responseMinutes: 6, skills: ["car-wash", "laundry", "moving"], zones: ["al-wakrah", "al-rayyan"], languages: ["en", "ml"], verified: true, yearsExperience: 6 },
];

export interface MatchInput {
  serviceId: string;
  zoneId: ZoneId;
  language?: LanguageCode;
  genderPreference?: "male" | "female";
  urgent?: boolean;
}

/**
 * AI provider matching (weights from the product blueprint):
 * distance 20% · availability 20% · skill 20% · rating 15% ·
 * completion 10% · response time 5% · language 5% · preference 5%
 */
export function matchProviders(input: MatchInput, limit = 3): MatchResult[] {
  const results: MatchResult[] = [];

  for (const p of PROVIDERS) {
    if (!p.skills.includes(input.serviceId)) continue;
    if (input.genderPreference && p.gender !== input.genderPreference) continue;

    const inZone = p.zones.includes(input.zoneId);
    const distance = inZone ? 1 : 0.35; // out-of-zone pros can travel, scored lower
    const availability = input.urgent ? (p.responseMinutes <= 6 ? 1 : 0.5) : 1;
    const skill = Math.min(1, p.yearsExperience / 10);
    const rating = (p.rating - 4) / 1; // 4.0→0 … 5.0→1
    const completion = p.completionRate;
    const response = Math.max(0, 1 - p.responseMinutes / 15);
    const language = input.language && p.languages.includes(input.language) ? 1 : 0.4;
    const preference = input.genderPreference ? 1 : 0.8;

    const breakdown = {
      distance: distance * 0.2,
      availability: availability * 0.2,
      skill: skill * 0.2,
      rating: rating * 0.15,
      completion: completion * 0.1,
      response: response * 0.05,
      language: language * 0.05,
      preference: preference * 0.05,
    };
    const score = Object.values(breakdown).reduce((a, b) => a + b, 0);
    results.push({ provider: p, score: Math.round(score * 100) / 100, breakdown });
  }

  return results.sort((a, b) => b.score - a.score).slice(0, limit);
}
