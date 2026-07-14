"use client";

import { BOOKS } from "@/lib/books";
import { AI_CURRICULUM } from "@/lib/curriculum";
import { totalAiSessions } from "@/lib/scoring";
import { DailyCheckin, Goals } from "@/lib/types";
import { Card } from "./ui";

export default function Library({
  goals,
  history,
}: {
  goals: Goals;
  history: DailyCheckin[];
}) {
  const sessions = totalAiSessions(history);
  const nextIdx = sessions % AI_CURRICULUM.length;

  return (
    <div className="space-y-4">
      <Card title="📖 Personal-growth library">
        <p className="mb-3 text-sm text-inkSoft">
          One important chapter a day. Your current book is{" "}
          <strong>{goals.currentBook}</strong> — change it on the Goals tab.
        </p>
        <div className="grid gap-4 md:grid-cols-2">
          {BOOKS.map((book) => (
            <div
              key={book.title}
              className={`rounded-xl border p-4 ${
                book.title === goals.currentBook ? "border-grove bg-grove/5" : "border-mist bg-pearl"
              }`}
            >
              <div className="font-display font-semibold text-ink">{book.title}</div>
              <div className="text-xs text-inkSoft">
                {book.author} · {book.theme}
              </div>
              <ul className="mt-2 space-y-1 text-xs text-inkSoft">
                {book.chapters.map((ch) => (
                  <li key={ch.title}>
                    <span className="font-medium text-ink">{ch.title}.</span> {ch.takeaway}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </Card>

      <Card title="🤖 AI-builder curriculum">
        <p className="mb-3 text-sm text-inkSoft">
          {sessions} session{sessions === 1 ? "" : "s"} completed. The list repeats with deeper
          practice once you finish a pass.
        </p>
        <ol className="space-y-2">
          {AI_CURRICULUM.map((lesson, i) => (
            <li
              key={lesson.topic}
              className={`rounded-xl border px-4 py-2.5 text-sm ${
                i === nextIdx ? "border-grove bg-grove/5" : "border-mist bg-pearl"
              }`}
            >
              <span className="font-semibold text-ink">
                {i + 1}. {lesson.topic}
                {i === nextIdx && <span className="ml-2 rounded-full bg-grove px-2 py-0.5 text-[10px] font-bold uppercase text-white">next up</span>}
              </span>
              <div className="text-inkSoft">{lesson.task}</div>
            </li>
          ))}
        </ol>
      </Card>
    </div>
  );
}
