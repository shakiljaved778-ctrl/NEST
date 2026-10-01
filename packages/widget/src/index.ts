export {
  AmilInsight,
  defineAmilInsight,
  type AmilOptionDetail,
  type AmilReadyDetail,
} from "./amil-insight";

export {
  AmilAssistant,
  defineAmilAssistant,
  type AmilAssistantOptionDetail,
} from "./amil-assistant";

/** Lit web components. */
export const WIDGET_TAGS = ["amil-insight", "amil-assistant"] as const;
