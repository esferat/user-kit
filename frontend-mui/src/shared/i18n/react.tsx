import { useSyncExternalStore } from 'react';

import { getLocale, i18n } from './store';

import type { Locale, TranslationParams } from './i18n';

function localeSnapshot(): Locale {
  return getLocale();
}

/** Подписывает компонент на язык интерфейса. */
export function useLocale(): Locale {
  return useSyncExternalStore(i18n.subscribe, localeSnapshot, localeSnapshot);
}

/**
 * Переводчик для компонентов: вызов `t` во время рендера выводит текст
 * активной локали, а смена языка перерисовывает каждый компонент, который её
 * использует.
 */
export function useTranslate(): (key: string, params?: TranslationParams) => string {
  useLocale();
  return i18n.t;
}
