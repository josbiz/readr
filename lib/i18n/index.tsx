"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";
import { LOCALES, type Locale } from "../settings";
import { useSettings } from "../use-settings";
import { en, type MessageKey, type Messages } from "./en";
import { es } from "./es";
import { fr } from "./fr";
import { pt } from "./pt";
import { de } from "./de";
import { it } from "./it";

export type { MessageKey };

export const dictionaries: Record<Locale, Messages> = { en, es, fr, pt, de, it };

/** Each language in its own name, whatever the interface language. */
export const LOCALE_NAMES: Record<Locale, string> = {
  en: "English",
  es: "Español",
  fr: "Français",
  pt: "Português",
  de: "Deutsch",
  it: "Italiano",
};

/** The first preferred language when its primary subtag is supported (any region), English otherwise. */
export function detectLocale(languages: readonly string[]): Locale {
  const primary = languages[0]?.toLowerCase().split("-")[0];
  return LOCALES.find((locale) => locale === primary) ?? "en";
}

export function translate(
  messages: Messages,
  key: MessageKey,
  params?: Record<string, string | number>,
): string {
  const text = messages[key];
  return params ? text.replace(/\{(\w+)\}/g, (m, name: string) => String(params[name] ?? m)) : text;
}

export interface I18n {
  locale: Locale;
  t: (key: MessageKey, params?: Record<string, string | number>) => string;
  percent: (fraction: number) => string;
  date: (time: number) => string;
}

function browserLanguages(): readonly string[] {
  return typeof navigator === "undefined" ? [] : navigator.languages ?? [navigator.language];
}

function makeI18n(locale: Locale): I18n {
  const messages = dictionaries[locale];
  const percentFmt = new Intl.NumberFormat(locale, { style: "percent", maximumFractionDigits: 0 });
  const dateFmt = new Intl.DateTimeFormat(locale, { dateStyle: "medium" });
  return {
    locale,
    t: (key, params) => translate(messages, key, params),
    percent: (fraction) => percentFmt.format(fraction),
    date: (time) => dateFmt.format(time),
  };
}

const I18nContext = createContext<I18n>(makeI18n("en"));

export function I18nProvider({ children }: { children: ReactNode }) {
  const { locale: chosen } = useSettings();
  const locale = chosen ?? detectLocale(browserLanguages());
  const value = useMemo(() => makeI18n(locale), [locale]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18n {
  return useContext(I18nContext);
}
