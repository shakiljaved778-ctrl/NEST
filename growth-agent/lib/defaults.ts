import { Goals } from "./types";

/**
 * Sensible starting targets with a founder-focused career track.
 * Everything here is editable on the Goals screen.
 */
export const DEFAULT_GOALS: Goals = {
  name: "Shakil",
  email: "shakil.mdj@outlook.com",
  careerFocus: [
    "Investor-readiness: sharpen the NEST pitch, metrics, and data room",
    "Thought leadership on home services + AI in Qatar and the Gulf",
    "Fundraising skills: cold outreach, warm intros, term-sheet literacy",
    "Operating cadence: weekly KPIs, hiring pipeline, unit economics",
  ],
  linkedinPostsPerDay: 1,
  linkedinEngagementsPerDay: 3,
  chaptersPerDay: 1,
  currentBook: "Atomic Habits",
  workoutMinutesPerDay: 30,
  currentWeightKg: null,
  targetWeightKg: null,
  weeklyWeightLossKg: 0.5,
  aiSessionsPerDay: 1,
  currency: "QAR",
  weeklySavingsTarget: 500,
};
