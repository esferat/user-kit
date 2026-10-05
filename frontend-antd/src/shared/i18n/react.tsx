import { useSyncExternalStore } from 'react';

import { getLocale, i18n } from './store';

import type { Locale, TranslationParams } from './i18n';

function localeSnapshot(): Locale {
  return getLocale();
}

/** Subscribes a component to the interface language. */
export function useLocale(): Locale {
  return useSyncExternalStore(i18n.subscribe, localeSnapshot, localeSnapshot);
}

/**
 * Translator for components: calling `t` during the render paints the text of the
 * active locale, and a language change re-renders every component that uses it.
 */
export function useTranslate(): (key: string, params?: TranslationParams) => string {
  useLocale();
  return i18n.t;
}
