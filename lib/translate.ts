import type { LanguageCode } from "./types";

/**
 * AI chat-translation layer — MVP implementation.
 *
 * Production runs `chat-translate@v1` (docs/AI-ORCHESTRATION.md) through the
 * LLM gateway. The MVP translates the high-frequency service phrases from a
 * curated phrasebook (native-speaker reviewed), detects the source language by
 * script/keywords, and flags emergencies in any language. Unknown text passes
 * through unchanged with `translated: false`, mirroring the production
 * degradation mode. Original + translation are both stored on chat messages.
 */

export interface TranslationResult {
  translation: string;
  sourceLang: LanguageCode;
  targetLang: LanguageCode;
  /** false = passthrough (phrase not in the MVP phrasebook). */
  translated: boolean;
  flagEmergency: boolean;
}

/** High-frequency chat phrases across the six pilot languages (key = phrase id). */
const PHRASEBOOK: Record<string, Record<LanguageCode, string>> = {
  on_my_way: {
    en: "I am on my way",
    ar: "أنا في الطريق",
    hi: "मैं रास्ते में हूँ",
    ur: "میں راستے میں ہوں",
    ml: "ഞാൻ വരുന്ന വഴിയാണ്",
    tl: "Papunta na ako",
  },
  arrived: {
    en: "I have arrived",
    ar: "لقد وصلت",
    hi: "मैं पहुँच गया हूँ",
    ur: "میں پہنچ گیا ہوں",
    ml: "ഞാൻ എത്തി",
    tl: "Nandito na ako",
  },
  running_late: {
    en: "I am running 10 minutes late",
    ar: "سأتأخر ١٠ دقائق",
    hi: "मुझे 10 मिनट की देरी होगी",
    ur: "مجھے 10 منٹ کی تاخیر ہوگی",
    ml: "എനിക്ക് 10 മിനിറ്റ് വൈകും",
    tl: "Male-late ako ng 10 minuto",
  },
  where_park: {
    en: "Where can I park?",
    ar: "أين يمكنني ركن السيارة؟",
    hi: "मैं गाड़ी कहाँ खड़ी करूँ?",
    ur: "میں گاڑی کہاں کھڑی کروں؟",
    ml: "ഞാൻ എവിടെ പാർക്ക് ചെയ്യണം?",
    tl: "Saan ako puwedeng pumarada?",
  },
  job_done: {
    en: "The job is complete",
    ar: "تم إنجاز العمل",
    hi: "काम पूरा हो गया है",
    ur: "کام مکمل ہو گیا ہے",
    ml: "ജോലി പൂർത്തിയായി",
    tl: "Tapos na ang trabaho",
  },
  thank_you: {
    en: "Thank you",
    ar: "شكراً",
    hi: "धन्यवाद",
    ur: "شکریہ",
    ml: "നന്ദി",
    tl: "Salamat",
  },
  please_wait: {
    en: "Please wait a moment",
    ar: "انتظر لحظة من فضلك",
    hi: "कृपया एक क्षण प्रतीक्षा करें",
    ur: "براہ کرم ایک لمحہ انتظار کریں",
    ml: "ദയവായി ഒരു നിമിഷം കാത്തിരിക്കൂ",
    tl: "Sandali lang po",
  },
  need_access: {
    en: "Please open the door",
    ar: "من فضلك افتح الباب",
    hi: "कृपया दरवाज़ा खोलें",
    ur: "براہ کرم دروازہ کھولیں",
    ml: "ദയവായി വാതിൽ തുറക്കൂ",
    tl: "Pakibuksan po ang pinto",
  },
};

const EMERGENCY_MARKERS = [
  "fire", "smoke", "gas smell", "shock", "injured", "injury", "flood", "emergency",
  "حريق", "دخان", "طوارئ", "صدمة كهربائية",
  "आग", "धुआँ", "आपातकाल",
  "آگ", "دھواں", "ایمرجنسی",
  "തീ", "പുക", "അടിയന്തരം",
  "sunog", "usok", "emerhensiya",
];

/** Best-effort source-language detection by script, then keywords. */
export function detectLanguage(text: string): LanguageCode {
  if (/[ऀ-ॿ]/.test(text)) return "hi"; // Devanagari
  if (/[ഀ-ൿ]/.test(text)) return "ml"; // Malayalam
  if (/[؀-ۿ]/.test(text)) {
    // Arabic script — Urdu-specific letters distinguish it from Arabic
    return /[ٹڈڑںھےۓ]/.test(text) ? "ur" : "ar";
  }
  const lower = text.toLowerCase();
  const tagalogHints = ["ako", "po", "ang", "na ", "salamat", "saan", "hindi"];
  if (tagalogHints.some((w) => lower.includes(w))) return "tl";
  return "en";
}

function normalize(s: string): string {
  return s.trim().toLowerCase().replace(/[.!?؟।]+$/u, "").replace(/\s+/g, " ");
}

export function translateMessage(message: string, targetLang: LanguageCode, sourceLang?: LanguageCode): TranslationResult {
  const source = sourceLang ?? detectLanguage(message);
  const flagEmergency = EMERGENCY_MARKERS.some((m) => message.toLowerCase().includes(m));

  if (source === targetLang) {
    return { translation: message, sourceLang: source, targetLang, translated: true, flagEmergency };
  }

  const needle = normalize(message);
  for (const variants of Object.values(PHRASEBOOK)) {
    if (normalize(variants[source]) === needle) {
      return { translation: variants[targetLang], sourceLang: source, targetLang, translated: true, flagEmergency };
    }
  }

  // Passthrough degradation mode: keep the original, mark untranslated.
  return { translation: message, sourceLang: source, targetLang, translated: false, flagEmergency };
}
