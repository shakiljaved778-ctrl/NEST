"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import type { Lang } from "@/data/content";
import { translate, type StringKey } from "@/data/i18n";

type Ctx = {
  lang: Lang;
  dir: "ltr" | "rtl";
  setLang: (l: Lang) => void;
  toggle: () => void;
  t: (key: StringKey) => string;
};

const LanguageContext = createContext<Ctx | null>(null);

const STORAGE_KEY = "qs.lang";

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>("en");

  // Restore preference on mount.
  useEffect(() => {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (saved === "ar" || saved === "en") setLangState(saved);
  }, []);

  // Reflect language + direction on <html> so the whole document flips.
  useEffect(() => {
    const root = document.documentElement;
    root.lang = lang;
    root.dir = lang === "ar" ? "rtl" : "ltr";
    window.localStorage.setItem(STORAGE_KEY, lang);
  }, [lang]);

  const setLang = useCallback((l: Lang) => setLangState(l), []);
  const toggle = useCallback(
    () => setLangState((p) => (p === "en" ? "ar" : "en")),
    []
  );
  const t = useCallback((key: StringKey) => translate(lang, key), [lang]);

  return (
    <LanguageContext.Provider
      value={{ lang, dir: lang === "ar" ? "rtl" : "ltr", setLang, toggle, t }}
    >
      {children}
    </LanguageContext.Provider>
  );
}

export function useLang(): Ctx {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error("useLang must be used within LanguageProvider");
  return ctx;
}
