import { findBook, BOOKS } from "./books";
import { nextLesson } from "./curriculum";
import { ideaForDate } from "./linkedin";
import {
  computeStreaks,
  totalAiSessions,
  weekSummary,
  weightTrend,
} from "./scoring";
import {
  CoachBriefing,
  CoachEngine,
  CoachInput,
  PostFeedback,
  TrackKey,
} from "./types";

const MOTIVATIONS = [
  "Discipline is choosing between what you want now and what you want most.",
  "You don't rise to the level of your goals; you fall to the level of your systems.",
  "Founders are made on the ordinary days nobody is watching.",
  "One post, one chapter, one workout, one lesson, one dirham saved — that's an empire in slow motion.",
  "Consistency compounds. Show up small today rather than big someday.",
  "The market rewards the founder who kept learning after everyone else stopped.",
  "Your future self is watching today's check-in.",
  "Hard days build the story you'll tell investors — and your kids.",
];

const FINANCE_TIPS = [
  "Pay yourself first: move the daily savings amount the moment income lands, before any spending.",
  "Review one recurring subscription today — cancel or downgrade anything you haven't used in 30 days.",
  "Keep personal and company money strictly separate; founders who blur them pay for it at due diligence.",
  "Automate the transfer: a standing order beats willpower every single week.",
  "Track net worth monthly, not daily — direction over noise.",
  "Before any purchase over 200 QAR today, wait 24 hours. Most urges expire overnight.",
  "An emergency fund of 3–6 months of expenses is a founder's real runway at home.",
];

function pick(list: string[], isoDate: string, salt: number): string {
  const seed = isoDate
    .split("")
    .reduce((acc, ch) => (acc * 33 + ch.charCodeAt(0)) % 100000, salt);
  return list[seed % list.length];
}

/**
 * Rule-based coach: free, offline, deterministic per day.
 * To upgrade to LLM coaching, implement CoachEngine with a Claude API call
 * (see README "Upgrading the coach") and return it from getCoach().
 */
export class RuleBasedCoach implements CoachEngine {
  dailyBriefing(input: CoachInput): CoachBriefing {
    const { goals, history, today } = input;
    const streaks = computeStreaks(history, goals, today);
    const week = weekSummary(history, goals, today);
    const weight = weightTrend(history, today);

    const headline =
      streaks.overall >= 3
        ? `${goals.name}, you're on a ${streaks.overall}-day streak — protect it today.`
        : week.daysLogged === 0
          ? `${goals.name}, a fresh week. Today is day one — log your first check-in.`
          : `${goals.name}, last 7 days average ${week.avgScore}/100. Today can raise it.`;

    const trackAdvice: { track: TrackKey; message: string }[] = [
      {
        track: "career",
        message:
          week.careerActions >= 5
            ? "Strong week of deliberate career moves. Pick today's from your focus list and go deeper, not wider."
            : `Do ONE deliberate career action today. Suggestion: ${goals.careerFocus[week.careerActions % Math.max(goals.careerFocus.length, 1)] ?? "advance your top career goal"}.`,
      },
      {
        track: "linkedin",
        message:
          streaks.byTrack.linkedin >= 3
            ? `Posting streak: ${streaks.byTrack.linkedin} days. Consistency is building your authority — don't skip today.`
            : `${week.posts}/7 posts this week. Ship today's post before noon; done beats perfect.`,
      },
      {
        track: "reading",
        message:
          streaks.byTrack.reading >= 3
            ? `Reading streak: ${streaks.byTrack.reading} days. One important chapter today keeps the compounding alive.`
            : "Read one important chapter today — 15 focused minutes. Suggestion below.",
      },
      {
        track: "fitness",
        message: fitnessMessage(goals, weight, week.workoutMinutes),
      },
      {
        track: "aiLearning",
        message: `You're ${totalAiSessions(history)} sessions into the AI curriculum. Today's lesson is queued below — 30 focused minutes.`,
      },
      {
        track: "finance",
        message:
          week.saved >= goals.weeklySavingsTarget
            ? `Weekly savings target hit (${week.saved}/${goals.weeklySavingsTarget} ${goals.currency}). Keep the habit; consider routing the surplus to investments.`
            : `${week.saved}/${goals.weeklySavingsTarget} ${goals.currency} saved this week. Move ~${Math.max(Math.round((goals.weeklySavingsTarget - week.saved) / 7), 1)} ${goals.currency} today to stay on pace.`,
      },
    ];

    return {
      headline,
      motivation: pick(MOTIVATIONS, today, 3),
      trackAdvice,
      linkedinIdea: ideaForDate(today),
      chapterSuggestion: suggestChapter(goals.currentBook, history.length),
      aiLesson: nextLesson(totalAiSessions(history)),
      financeTip: pick(FINANCE_TIPS, today, 11),
    };
  }

  reviewLinkedinPost(text: string): PostFeedback {
    const strengths: string[] = [];
    const improvements: string[] = [];
    const trimmed = text.trim();
    const words = trimmed.split(/\s+/).filter(Boolean).length;
    const lines = trimmed.split(/\n/).filter((l) => l.trim().length > 0);
    const firstLine = lines[0] ?? "";
    const hashtags = (trimmed.match(/#[\w]+/g) ?? []).length;
    const asksQuestion = /\?/.test(trimmed);
    const hasNumbers = /\d/.test(trimmed);
    const hasCta =
      /(comment|share|follow|dm|let me know|what do you think|agree|thoughts)/i.test(trimmed);

    let score = 40;

    if (words >= 50 && words <= 300) {
      score += 15;
      strengths.push(`Good length (${words} words) — substantial but scannable.`);
    } else if (words < 50) {
      improvements.push(`Quite short (${words} words). Add a concrete example or lesson to give it weight.`);
    } else {
      improvements.push(`Long (${words} words). Tighten it — cut the warm-up, keep the story.`);
    }

    if (firstLine.length > 0 && firstLine.length <= 80) {
      score += 10;
      strengths.push("Punchy first line — good hook potential before the fold.");
    } else {
      improvements.push("Your first line is the hook. Keep it under ~80 characters and make it a claim, number, or question.");
    }

    if (lines.length >= 4) {
      score += 10;
      strengths.push("Broken into short lines — easy to read on mobile.");
    } else {
      improvements.push("Break the post into short 1–2 sentence lines; walls of text get skipped.");
    }

    if (hasNumbers) {
      score += 10;
      strengths.push("Contains specifics/numbers — concrete beats abstract.");
    } else {
      improvements.push("Add one specific number or detail (a metric, a date, a count) to build credibility.");
    }

    if (asksQuestion || hasCta) {
      score += 10;
      strengths.push("Invites engagement with a question or call to action.");
    } else {
      improvements.push("End with a question or a light call to action to invite comments.");
    }

    if (hashtags >= 1 && hashtags <= 5) {
      score += 5;
      strengths.push(`Sensible hashtag count (${hashtags}).`);
    } else if (hashtags === 0) {
      improvements.push("Add 2–3 relevant hashtags (e.g. #Qatar #startups #AI) for discovery.");
    } else {
      improvements.push(`${hashtags} hashtags is too many — keep it to 3–5 targeted ones.`);
    }

    return { score: Math.min(score, 100), strengths, improvements };
  }
}

function fitnessMessage(
  goals: { workoutMinutesPerDay: number; targetWeightKg: number | null; weeklyWeightLossKg: number },
  weight: { current: number | null; weekChange: number | null },
  weekMinutes: number
): string {
  const parts: string[] = [];
  parts.push(`Target: ${goals.workoutMinutesPerDay} min today (${weekMinutes} min logged this week).`);
  if (weight.current != null && weight.weekChange != null) {
    if (weight.weekChange <= -goals.weeklyWeightLossKg) {
      parts.push(`Weight is down ${Math.abs(weight.weekChange)} kg this week — on plan. Keep protein high and stay the course.`);
    } else if (weight.weekChange < 0) {
      parts.push(`Down ${Math.abs(weight.weekChange)} kg this week — progress, slightly under the ${goals.weeklyWeightLossKg} kg/week pace. Add one extra walk.`);
    } else {
      parts.push(`Up ${weight.weekChange} kg vs last week. No panic — tighten evening snacks and log every weigh-in this week.`);
    }
  } else if (weight.current == null) {
    parts.push("No weigh-in yet — step on the scale at your next check-in so I can track the trend.");
  }
  if (weight.current != null && goals.targetWeightKg != null) {
    const toGo = Math.round((weight.current - goals.targetWeightKg) * 10) / 10;
    if (toGo > 0) parts.push(`${toGo} kg to your ${goals.targetWeightKg} kg target.`);
    else parts.push("You're at (or past) your target weight — shift to maintenance.");
  }
  return parts.join(" ");
}

function suggestChapter(
  currentBook: string,
  daysLogged: number
): { book: string; chapter: string; why: string } {
  const book = findBook(currentBook) ?? BOOKS[0];
  const chapter = book.chapters[daysLogged % book.chapters.length];
  return {
    book: `${book.title} — ${book.author}`,
    chapter: chapter.title,
    why: chapter.takeaway,
  };
}

/**
 * Single place the app obtains its coach. Swap the implementation here to
 * upgrade from rule-based to Claude-API-powered coaching.
 */
export function getCoach(): CoachEngine {
  return new RuleBasedCoach();
}
