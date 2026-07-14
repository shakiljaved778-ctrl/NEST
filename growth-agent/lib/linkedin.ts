/**
 * Founder-focused LinkedIn post prompts: home services, AI, and company
 * building in Qatar/the Gulf. One idea is suggested per day, rotating
 * deterministically by date so the daily briefing is stable.
 */
export const LINKEDIN_IDEAS: string[] = [
  "Share one real lesson from building NEST this week — what broke, what you changed, what you'd tell another founder.",
  "Post a before/after story: a customer problem in Qatar's home-services market and how a verified-pro model fixes it.",
  "Explain in plain words how AI picks the right technician for a job — teach your audience one concept.",
  "Write about hiring: the one question you now ask every candidate, and why.",
  "Share a number: one metric you track weekly (bookings, response time, NPS) and what it taught you this month.",
  "Contrarian take: what everyone gets wrong about super apps in the Gulf — and what you're doing instead.",
  "Tell your origin story in 5 short lines: why you started NEST and the moment you knew it mattered.",
  "Break down one AI tool you used this week to move faster — with the exact prompt or workflow.",
  "Ask your network a genuine question: what's the worst home-service experience you've had in Doha?",
  "Celebrate a provider: tell the story of one technician on your platform and what 'trusted' really means.",
  "Share your fundraising learning of the week — one thing investors asked that made you think.",
  "Post a 'how it's going' update: 3 wins, 1 struggle, 1 ask. Vulnerability builds trust.",
  "Teach a mini-framework you use: how you prioritize features, triage complaints, or price services.",
  "Write about Qatar's market specifically: one local insight outsiders miss about serving homes here.",
];

/** Deterministic idea-of-the-day: same date always yields the same idea. */
export function ideaForDate(isoDate: string): string {
  const seed = isoDate
    .split("")
    .reduce((acc, ch) => (acc * 31 + ch.charCodeAt(0)) % 100000, 7);
  return LINKEDIN_IDEAS[seed % LINKEDIN_IDEAS.length];
}
