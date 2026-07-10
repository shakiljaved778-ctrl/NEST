import { describe, expect, it } from "vitest";
import { detectLanguage, translateMessage } from "../lib/translate";

describe("detectLanguage", () => {
  it("detects by script", () => {
    expect(detectLanguage("أنا في الطريق")).toBe("ar");
    expect(detectLanguage("میں راستے میں ہوں")).toBe("ur"); // Urdu-specific letters
    expect(detectLanguage("मैं रास्ते में हूँ")).toBe("hi");
    expect(detectLanguage("ഞാൻ വരുന്ന വഴിയാണ്")).toBe("ml");
  });

  it("detects Tagalog by keywords and defaults to English", () => {
    expect(detectLanguage("Papunta na ako")).toBe("tl");
    expect(detectLanguage("I have arrived")).toBe("en");
  });
});

describe("translateMessage", () => {
  it("translates phrasebook messages EN → AR", () => {
    const r = translateMessage("I am on my way", "ar");
    expect(r.translation).toBe("أنا في الطريق");
    expect(r.sourceLang).toBe("en");
    expect(r.translated).toBe(true);
  });

  it("translates AR → TL (provider ↔ customer pair)", () => {
    const r = translateMessage("لقد وصلت", "tl");
    expect(r.translation).toBe("Nandito na ako");
    expect(r.translated).toBe(true);
  });

  it("translates HI → EN and is punctuation/case tolerant", () => {
    const r = translateMessage("काम पूरा हो गया है", "en");
    expect(r.translation).toBe("The job is complete");
    expect(translateMessage("i am on my way!", "ar").translated).toBe(true);
  });

  it("returns the original when source equals target", () => {
    const r = translateMessage("Thank you", "en");
    expect(r.translation).toBe("Thank you");
    expect(r.translated).toBe(true);
  });

  it("passes through unknown text untranslated (degradation mode)", () => {
    const r = translateMessage("The compressor mounting bracket is corroded", "ar");
    expect(r.translation).toBe("The compressor mounting bracket is corroded");
    expect(r.translated).toBe(false);
  });

  it("flags emergencies in any language, even on passthrough", () => {
    expect(translateMessage("There is a fire in the kitchen", "ar").flagEmergency).toBe(true);
    expect(translateMessage("يوجد حريق في المطبخ", "en").flagEmergency).toBe(true);
    expect(translateMessage("may sunog sa kusina", "en").flagEmergency).toBe(true);
    expect(translateMessage("I am on my way", "ar").flagEmergency).toBe(false);
  });

  it("respects an explicit sourceLang override", () => {
    const r = translateMessage("Salamat", "en", "tl");
    expect(r.translation).toBe("Thank you");
    expect(r.sourceLang).toBe("tl");
  });
});
