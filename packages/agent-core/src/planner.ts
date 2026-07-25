import { type TripIntent, type TastePrefs } from "@voyara/contracts";
import { parseIntent } from "./intent.js";

/**
 * The model is wrapped behind this interface so the provider is swappable
 * (Anthropic API default in later phases; env-configurable). Phase 0 ships a
 * deterministic HeuristicPlanner that needs no key.
 */
export interface Planner {
  readonly name: string;
  parse(raw: string, taste?: TastePrefs, now?: Date): Promise<TripIntent>;
}

export class HeuristicPlanner implements Planner {
  readonly name = "heuristic";
  async parse(raw: string, taste?: TastePrefs, now?: Date): Promise<TripIntent> {
    return parseIntent(raw, taste, now);
  }
}

/**
 * Factory that reads PLANNER_PROVIDER. Anthropic-backed planner is added in a
 * later phase; until then everything falls back to the heuristic planner.
 */
export function createPlanner(provider = process.env.PLANNER_PROVIDER): Planner {
  switch (provider) {
    case "anthropic":
      // Placeholder: real AnthropicPlanner lands in Phase 1 behind the same
      // interface. Falls back to heuristic when no key is configured.
      return new HeuristicPlanner();
    default:
      return new HeuristicPlanner();
  }
}
