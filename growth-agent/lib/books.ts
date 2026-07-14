import { Book } from "./types";

/**
 * Curated personal-growth library. The coach walks you through these
 * chapter by chapter — one important chapter a day.
 */
export const BOOKS: Book[] = [
  {
    title: "Atomic Habits",
    author: "James Clear",
    theme: "Small habits, remarkable results",
    chapters: [
      { title: "The Surprising Power of Atomic Habits", takeaway: "1% better every day compounds to 37x better in a year." },
      { title: "How Your Habits Shape Your Identity", takeaway: "Every action is a vote for the person you want to become." },
      { title: "How to Build Better Habits in 4 Simple Steps", takeaway: "Cue → craving → response → reward: design each stage." },
      { title: "The Man Who Didn't Look Right", takeaway: "Awareness precedes change — use a habits scorecard." },
      { title: "The Best Way to Start a New Habit", takeaway: "Implementation intentions: I will [X] at [time] in [place]." },
      { title: "Motivation Is Overrated; Environment Often Matters More", takeaway: "Make the cues of good habits obvious in your space." },
      { title: "The 2-Minute Rule", takeaway: "Scale any habit down to a 2-minute version to start." },
      { title: "The Goldilocks Rule", takeaway: "Peak motivation lives at the edge of your current ability." },
    ],
  },
  {
    title: "The 7 Habits of Highly Effective People",
    author: "Stephen R. Covey",
    theme: "Character-first effectiveness",
    chapters: [
      { title: "Be Proactive", takeaway: "Work your circle of influence, not your circle of concern." },
      { title: "Begin with the End in Mind", takeaway: "Write your personal mission before your to-do list." },
      { title: "Put First Things First", takeaway: "Schedule the important-but-not-urgent (Quadrant II)." },
      { title: "Think Win/Win", takeaway: "Abundance mindset turns negotiations into partnerships." },
      { title: "Seek First to Understand, Then to Be Understood", takeaway: "Empathic listening is the fastest route to influence." },
      { title: "Synergize", takeaway: "Value differences — the whole beats the sum of parts." },
      { title: "Sharpen the Saw", takeaway: "Renew body, mind, heart, and spirit on a schedule." },
    ],
  },
  {
    title: "Deep Work",
    author: "Cal Newport",
    theme: "Focused success in a distracted world",
    chapters: [
      { title: "Deep Work Is Valuable", takeaway: "The ability to focus is the career currency of this decade." },
      { title: "Deep Work Is Rare", takeaway: "Busyness is not productivity; visible effort is a trap." },
      { title: "Work Deeply", takeaway: "Ritualize: same place, same time, clear shutdown." },
      { title: "Embrace Boredom", takeaway: "Train concentration like a muscle — schedule distraction, not focus." },
      { title: "Quit Social Media (Selectively)", takeaway: "Use tools only if benefits beat costs for YOUR goals." },
      { title: "Drain the Shallows", takeaway: "Budget shallow work; every minute gets a job." },
    ],
  },
  {
    title: "The Psychology of Money",
    author: "Morgan Housel",
    theme: "Timeless lessons on wealth and greed",
    chapters: [
      { title: "No One's Crazy", takeaway: "Your money decisions make sense given your unique history." },
      { title: "Compounding", takeaway: "Time in the game beats timing the game — start now." },
      { title: "Getting Wealthy vs. Staying Wealthy", takeaway: "Getting rich needs optimism; staying rich needs paranoia." },
      { title: "Save Money", takeaway: "Savings = income − ego. The rate matters more than the return." },
      { title: "Freedom", takeaway: "Wealth's highest dividend is control over your time." },
      { title: "Room for Error", takeaway: "Plan on the plan not going to plan — build margin." },
    ],
  },
  {
    title: "Mindset",
    author: "Carol S. Dweck",
    theme: "The growth mindset",
    chapters: [
      { title: "The Mindsets", takeaway: "Abilities are grown, not fixed — believe it and act on it." },
      { title: "Inside the Mindsets", takeaway: "Effort is the path to mastery, not a sign of weakness." },
      { title: "The Truth About Ability and Accomplishment", takeaway: "Praise process, not talent — in yourself too." },
      { title: "Business: Mindset and Leadership", takeaway: "Growth-mindset leaders build teams that tell the truth." },
      { title: "Changing Mindsets", takeaway: "Add 'yet': I can't do this... yet." },
    ],
  },
  {
    title: "The Lean Startup",
    author: "Eric Ries",
    theme: "Build–measure–learn for founders",
    chapters: [
      { title: "Start", takeaway: "A startup is an experiment; treat every feature as a hypothesis." },
      { title: "Learn", takeaway: "Validated learning is the real unit of progress, not features shipped." },
      { title: "Leap", takeaway: "Name your value hypothesis and growth hypothesis explicitly." },
      { title: "Test", takeaway: "MVP: the fastest path through build–measure–learn." },
      { title: "Measure", takeaway: "Actionable metrics over vanity metrics — cohorts, not totals." },
      { title: "Pivot (or Persevere)", takeaway: "Schedule regular pivot-or-persevere meetings with the data." },
    ],
  },
];

/** Look up a book by title, case-insensitive; undefined if not in the library. */
export function findBook(title: string): Book | undefined {
  const t = title.trim().toLowerCase();
  return BOOKS.find((b) => b.title.toLowerCase() === t);
}
