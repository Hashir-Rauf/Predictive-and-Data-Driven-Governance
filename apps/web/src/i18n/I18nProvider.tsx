import type { Locale } from "@gov-dashboard/shared-types";
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import en from "./en.json";
import ru from "./ru.json";
import uz from "./uz.json";

const DICTIONARIES: Record<Locale, Record<string, string>> = { en, ru, uz };
const STORAGE_KEY = "gov-dashboard.locale";

const INTL_LOCALE: Record<Locale, string> = {
  uz: "uz-UZ",
  ru: "ru-RU",
  en: "en-US",
};

type TranslateParams = Record<string, string | number>;

interface I18nContextValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: string, params?: TranslateParams) => string;
  formatNumber: (value: number, options?: Intl.NumberFormatOptions) => string;
  formatDate: (isoDate: string, options?: Intl.DateTimeFormatOptions) => string;
}

function interpolate(template: string, params?: TranslateParams): string {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (match, key: string) => (key in params ? String(params[key]) : match));
}

const I18nContext = createContext<I18nContextValue | null>(null);

function readStoredLocale(): Locale {
  if (typeof window === "undefined") return "uz";
  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (stored === "uz" || stored === "ru" || stored === "en") return stored;
  return "uz";
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(readStoredLocale);

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next);
    window.localStorage.setItem(STORAGE_KEY, next);
  }, []);

  const value = useMemo<I18nContextValue>(() => {
    const dictionary = DICTIONARIES[locale];
    const intlLocale = INTL_LOCALE[locale];
    return {
      locale,
      setLocale,
      t: (key: string, params?: TranslateParams) => interpolate(dictionary[key] ?? key, params),
      formatNumber: (value, options) => new Intl.NumberFormat(intlLocale, options).format(value),
      formatDate: (isoDate, options) =>
        new Intl.DateTimeFormat(intlLocale, options ?? { year: "numeric", month: "short", day: "numeric" }).format(
          new Date(isoDate)
        ),
    };
  }, [locale, setLocale]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used within I18nProvider");
  return ctx;
}
