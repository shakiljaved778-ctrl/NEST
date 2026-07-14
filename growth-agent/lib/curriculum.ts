import { AiLesson } from "./types";

/**
 * A practical AI-builder curriculum: one focused session per day.
 * Ordered from fundamentals to shipping agentic products — tuned for a
 * founder building AI features into a real product.
 */
export const AI_CURRICULUM: AiLesson[] = [
  { topic: "LLM fundamentals", task: "Explain to yourself (out loud) what tokens, context windows, and temperature are. Write 5 lines of notes." },
  { topic: "Prompt engineering: structure", task: "Rewrite one prompt you use with role + context + task + format + examples. Compare outputs." },
  { topic: "Prompt engineering: few-shot", task: "Take a classification task from your product and craft 3 few-shot examples. Test edge cases." },
  { topic: "System prompts & guardrails", task: "Draft a system prompt for a customer-support bot: tone, refusals, escalation rules." },
  { topic: "Structured output", task: "Get a model to return strict JSON for a booking request (service, time, address). Validate it in code." },
  { topic: "Embeddings & similarity", task: "Read about embeddings, then sketch how you'd match a complaint to a category by similarity." },
  { topic: "RAG basics", task: "Diagram a retrieval-augmented pipeline: chunk → embed → store → retrieve → generate. Note failure modes." },
  { topic: "Evaluation", task: "Write 10 test cases (input → expected behavior) for one AI feature. Score a model against them." },
  { topic: "Tool use / function calling", task: "Define 2 tool schemas (e.g. get_quote, book_slot) and trace a full tool-use conversation on paper." },
  { topic: "Agents & orchestration", task: "Sketch an agent loop: plan → act → observe → repeat. Decide where a human must approve." },
  { topic: "Cost & latency engineering", task: "Estimate tokens and cost per user session for one feature. Find one caching win." },
  { topic: "Safety & privacy", task: "List PII your product touches; write 3 rules for what may never reach a model prompt." },
  { topic: "Fine-tuning vs prompting", task: "For one feature, argue both sides in 5 bullets each; pick one and justify it." },
  { topic: "Ship something tiny", task: "Build a 30-minute prototype: one prompt, one input box, one useful output. Demo it to someone." },
];

/** The next lesson given how many sessions are already completed (wraps around). */
export function nextLesson(sessionsCompleted: number): AiLesson {
  return AI_CURRICULUM[sessionsCompleted % AI_CURRICULUM.length];
}
