import { createI18n, DEFAULT_LOCALE, isLocale, LOCALES } from './i18n';
import { MESSAGES } from './locales';

import type { Locale } from './i18n';

import { config } from '@/shared/config';

export const SUPPORTED_LOCALES = LOCALES;

export const LOCALE_STORAGE_KEY = 'user-kit:locale';

export interface LocaleSources {
  stored?: string | null;
  browser?: string | null;
  fallback?: string;
}

/** Сопоставляет ярлык языка, например `ru-RU`, с поддерживаемой локалью. */
export function localeOfTag(tag: string | null | undefined): Locale | undefined {
  const primary = tag?.trim().toLowerCase().split(/[-_]/)[0];
  return primary !== undefined && isLocale(primary) ? primary : undefined;
}

/**
 * Приоритет: явный выбор пользователя, затем язык браузера, затем настроенный
 * по умолчанию. Побеждает первый источник, сопоставимый с известной локалью.
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
    // Браузер с отключённым хранилищем всё равно работает, выбор просто не сохраняется.
  }
}

function browserLocale(): string | null {
  return typeof navigator === 'undefined' ? null : navigator.language;
}

/**
 * Переводчик приложения. Это синглтон уровня модуля, потому что локаль —
 * свойство документа, а не отдельного компонента.
 */
export const i18n = createI18n(
  MESSAGES,
  resolveInitialLocale({
    stored: readStoredLocale(),
    browser: browserLocale(),
    fallback: config.defaultLocale,
  }),
);

/** Переводит вне компонента, например в хелпере `shared/lib`. */
export const t = i18n.t;

export function getLocale(): Locale {
  return i18n.getLocale();
}

/** Переключает язык, запоминает выбор и обновляет `<html lang>`. */
export function setLocale(locale: Locale): void {
  i18n.setLocale(locale);
  storeLocale(i18n.getLocale());
  applyLanguage();
}

export function applyLanguage(): void {
  document.documentElement.lang = i18n.getLocale();
}

/** Название локали на её родном языке, например `Русский` или `English`. */
export function localeName(locale: Locale): string {
  const name = MESSAGES[locale]['locale.name'];
  return typeof name === 'string' ? name : locale;
}
