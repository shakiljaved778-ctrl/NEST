import ar from "../messages/ar.json" with { type: "json" };
import en from "../messages/en.json" with { type: "json" };
import type { Locale } from "./format";

export type Messages = typeof en;
export const messages: Record<Locale, Messages> = { en, ar };
