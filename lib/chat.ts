import { getBooking } from "./store";
import { translateMessage } from "./translate";
import type { LanguageCode } from "./types";

/**
 * In-app chat with automatic translation.
 * Every message stores the original AND the translation into the recipient's
 * language (production contract), plus the emergency flag from the translation
 * layer so ops can intervene mid-conversation.
 */

export type ChatSender = "customer" | "provider";

export interface ChatMessage {
  id: string;
  bookingId: string;
  sender: ChatSender;
  original: string;
  originalLang: LanguageCode;
  translated: string;
  translatedLang: LanguageCode;
  flagEmergency: boolean;
  createdAt: string;
}

declare global {
  // eslint-disable-next-line no-var
  var __nestChat: ChatMessage[] | undefined;
}

function messages(): ChatMessage[] {
  if (!globalThis.__nestChat) globalThis.__nestChat = [];
  return globalThis.__nestChat;
}

export interface SendMessageInput {
  bookingId: string;
  sender: ChatSender;
  text: string;
  /** Language to translate into for the recipient. Defaults to the booking language for provider→customer, English for customer→provider. */
  recipientLang?: LanguageCode;
}

export function sendMessage(input: SendMessageInput): ChatMessage {
  const booking = getBooking(input.bookingId);
  if (!booking) throw new Error(`Unknown booking: ${input.bookingId}`);
  if (!input.text.trim()) throw new Error("Message cannot be empty");

  const recipientLang: LanguageCode =
    input.recipientLang ?? (input.sender === "provider" ? booking.language : "en");

  const t = translateMessage(input.text, recipientLang);
  const msg: ChatMessage = {
    id: `MSG-${messages().length + 1}`,
    bookingId: input.bookingId,
    sender: input.sender,
    original: input.text,
    originalLang: t.sourceLang,
    translated: t.translation,
    translatedLang: recipientLang,
    flagEmergency: t.flagEmergency,
    createdAt: new Date().toISOString(),
  };
  messages().push(msg);
  return msg;
}

export function threadFor(bookingId: string): ChatMessage[] {
  return messages().filter((m) => m.bookingId === bookingId);
}
