"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { en } from "./translations";
import type { Translate } from "../functions/types";

export const SUPPORTED_LOCALES = ["pt", "en"] as const;
export type Locale = (typeof SUPPORTED_LOCALES)[number];

export type { Translate };

type I18nContextValue = {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: Translate;
};

const I18nContext = createContext<I18nContextValue | null>(null);
const STORAGE_KEY = "ahk-hub-locale";

function interpolate(text: string, vars?: Record<string, string | number>): string {
  if (!vars) return text;
  let result = text;
  for (const [key, value] of Object.entries(vars)) {
    result = result.replaceAll(`{{${key}}}`, String(value));
  }
  return result;
}

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>("en");

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored === "pt" || stored === "en") setLocaleState(stored);
    } catch {
      // localStorage unavailable — keep default locale
    }
  }, []);

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // ignore
    }
  }, []);

  // Portuguese is the language every string is originally authored in, so it
  // needs no dictionary: the caller's fallback text IS the Portuguese copy.
  const t = useCallback<Translate>(
    (key, fallback, vars) => {
      const text = locale === "en" ? en[key] ?? fallback : fallback;
      return interpolate(text, vars);
    },
    [locale]
  );

  return (
    <I18nContext.Provider value={{ locale, setLocale, t }}>{children}</I18nContext.Provider>
  );
}

export function useTranslation() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useTranslation must be used within an I18nProvider");
  return ctx;
}
