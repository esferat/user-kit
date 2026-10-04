import { createI18n, DEFAULT_LOCALE, isLocale, LOCALES, type Locale } from './i18n';
import { MESSAGES } from './locales';

import { config } from '@/shared/config';

export const SUPPORTED_LOCALES = LOCALES;

export const LOCALE_STORAGE_KEY = 'user-kit:locale';

export interface LocaleSources {
  stored?: string | null;
  browser?: string | null;
  fallback?: string;
}

/** Maps a language tag such as `ru-RU` onto a supported locale. */
export function localeOfTag(tag: string | null | undefined): Locale | undefined {
  const primary = tag?.trim().toLowerCase().split(/[-_]/)[0];
  return primary !== undefined && isLocale(primary) ? primary : undefined;
}

/**
 * Precedence: the explicit choice of the user, then the language of the browser,
 * then the configured default. The first source that maps onto a known locale wins.
 */
export function resolveInitialLocale(sources: LocaleSources): Locale {
  return localeOfTag(sources.stored) ?? localeOfTag(sources.browser) ?? localeOfTag(sources.fallback) ?? DEFAULT_LOCALE;
}

function readStoredLocale(): string | null {
  try {
    return window.localStorage.getItem(LOCALE_STORAGE_KEY);
  } catch {
    return null;
  }
}

function storeLocale(locale: Locale): void {
  try {
    window.localStorage.setItem(LOCALE_STORAGE_KEY, locale);
  } catch {
    // A browser with disabled storage still works, the choice is simply not kept.
  }
}

function browserLocale(): string | null {
  return typeof navigator === 'undefined' ? null : navigator.language;
}

/** Translates the whole interface; imported as `import { t } from '@/shared/i18n'`. */
export const i18n = createI18n(
  MESSAGES,
  resolveInitialLocale({
    stored: readStoredLocale(),
    browser: browserLocale(),
    fallback: config.defaultLocale,
  }),
);

export const t = i18n.t;

export function getLocale(): Locale {
  return i18n.getLocale();
}

/** Switches the language, remembers the choice and updates `<html lang>`. */
export function setLocale(locale: Locale): void {
  i18n.setLocale(locale);
  storeLocale(i18n.getLocale());
  applyLanguage();
}

export function applyLanguage(): void {
  document.documentElement.lang = i18n.getLocale();
}

/** Native name of a locale, e.g. `Русский` or `English`, in that very language. */
export function localeName(locale: Locale): string {
  const name = MESSAGES[locale]['locale.name'];
  return typeof name === 'string' ? name : locale;
}

export { createI18n, DEFAULT_LOCALE, interpolate, isLocale, LOCALES, pluralCategory } from './i18n';
export type { Locale, MessageValue, Messages, PluralMessage, TranslationParams, Translator } from './i18n';
export { MESSAGES } from './locales';
