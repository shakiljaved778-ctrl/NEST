/** The six growth tracks the agent monitors. */
export type TrackKey =
  | "career"
  | "linkedin"
  | "reading"
  | "fitness"
  | "aiLearning"
  | "finance";

export const TRACKS: { key: TrackKey; label: string; emoji: string }[] = [
  { key: "career", label: "Career growth", emoji: "🚀" },
  { key: "linkedin", label: "LinkedIn presence", emoji: "💼" },
  { key: "reading", label: "Book reading", emoji: "📖" },
  { key: "fitness", label: "Fitness & weight", emoji: "💪" },
  { key: "aiLearning", label: "AI learning", emoji: "🤖" },
  { key: "finance", label: "Finance building", emoji: "💰" },
];

export interface Goals {
  name: string;
  /** Where daily digest emails are sent. */
  email: string;
  /** Founder-track career focus areas, shown to the coach. */
  careerFocus: string[];
  linkedinPostsPerDay: number;
  /** Meaningful comments / engagements target per day. */
  linkedinEngagementsPerDay: number;
  chaptersPerDay: number;
  currentBook: string;
  workoutMinutesPerDay: number;
  currentWeightKg: number | null;
  targetWeightKg: number | null;
  weeklyWeightLossKg: number;
  aiSessionsPerDay: number;
  currency: string;
  weeklySavingsTarget: number;
}

export interface DailyCheckin {
  /** ISO date, e.g. 2026-07-14 */
  date: string;
  careerAction: boolean;
  careerNote: string;
  linkedinPosted: boolean;
  linkedinPostText: string;
  linkedinEngagements: number;
  chapterRead: boolean;
  chapterNote: string;
  workoutMinutes: number;
  weightKg: number | null;
  aiLearningDone: boolean;
  aiTopic: string;
  savedAmount: number;
  notes: string;
}

export interface TrackScore {
  track: TrackKey;
  /** 0–100 for the day. */
  score: number;
  done: boolean;
  detail: string;
}

export interface DayScore {
  date: string;
  total: number;
  tracks: TrackScore[];
}

export interface Streaks {
  overall: number;
  byTrack: Record<TrackKey, number>;
  bestOverall: number;
}

export interface CoachInput {
  goals: Goals;
  history: DailyCheckin[];
  today: string;
}

export interface CoachBriefing {
  headline: string;
  motivation: string;
  trackAdvice: { track: TrackKey; message: string }[];
  linkedinIdea: string;
  chapterSuggestion: { book: string; chapter: string; why: string };
  aiLesson: { topic: string; task: string };
  financeTip: string;
}

export interface PostFeedback {
  score: number;
  strengths: string[];
  improvements: string[];
}

/**
 * The coaching engine contract. The default implementation is rule-based
 * (free, offline). To upgrade to LLM coaching, implement this interface
 * with a Claude API call and swap it in via getCoach() in lib/coach.ts.
 */
export interface CoachEngine {
  dailyBriefing(input: CoachInput): CoachBriefing;
  reviewLinkedinPost(text: string): PostFeedback;
}

export interface BookChapter {
  title: string;
  takeaway: string;
}

export interface Book {
  title: string;
  author: string;
  theme: string;
  chapters: BookChapter[];
}

export interface AiLesson {
  topic: string;
  task: string;
}
