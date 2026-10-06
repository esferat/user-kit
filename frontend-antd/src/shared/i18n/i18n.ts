export const LOCALES = ['ru', 'en'] as const;

export type Locale = (typeof LOCALES)[number];

/** Язык, используемый, когда в активной локали нет сообщения для ключа. */
export const DEFAULT_LOCALE: Locale = 'ru';

/**
 * Сообщение с формой множественного числа по категории CLDR. `few` и `many`
 * используются только языками, которым они нужны, `other` — обязательный
 * запасной вариант.
 */
export interface PluralMessage {
  one: string;
  few?: string;
  many?: string;
  other: string;
}

export type MessageValue = string | PluralMessage;

export type Messages = Readonly<Record<string, MessageValue>>;

export type TranslationParams = Readonly<Record<string, string | number>>;

export interface Translator {
  t(key: string, params?: TranslationParams): string;
  getLocale(): Locale;
  setLocale(locale: Locale): void;
  /**
   * Регистрирует слушателя, который вызывается после каждой смены локали.
   * `subscribe` существует, чтобы React-слой мог отслеживать локаль через
   * `useSyncExternalStore` вместо собственного механизма событий.
   */
  subscribe(listener: () => void): () => void;
}

export function isLocale(value: unknown): value is Locale {
  return typeof value === 'string' && (LOCALES as readonly string[]).includes(value);
}

/**
 * Выбирает категорию множественного числа CLDR для числа. `Intl.PluralRules`
 * охватывает все поддерживаемые языки; явные ветки делают результат
 * предсказуемым в окружениях без полных данных ICU.
 */
export function pluralCategory(count: number, locale: Locale): keyof PluralMessage {
  const absolute = Math.abs(count);
  if (locale === 'en') {
    return absolute === 1 ? 'one' : 'other';
  }
  if (absolute % 10 === 1 && absolute % 100 !== 11) {
    return 'one';
  }
  if (absolute % 10 >= 2 && absolute % 10 <= 4 && (absolute % 100 < 12 || absolute % 100 > 14)) {
    return 'few';
  }
  return 'many';
}

function selectPlural(message: PluralMessage, count: number | undefined, locale: Locale): string {
  const category = count === undefined ? 'other' : pluralCategory(count, locale);
  return message[category] ?? message.other;
}

/** Заменяет плейсхолдеры `{name}`; неизвестные плейсхолдеры остаются как есть. */
export function interpolate(template: string, params?: TranslationParams): string {
  if (params === undefined) {
    return template;
  }
  return template.replace(/\{(\w+)}/g, (match, name: string) => {
    const value = params[name];
    return value === undefined ? match : String(value);
  });
}

/**
 * Создаёт переводчик над набором словарей. Ключ, отсутствующий в активной
 * локали, откатывается к `defaultLocale` и в итоге к самому ключу, поэтому
 * отсутствующий перевод видно, но приложение никогда не ломается.
 */
export function createI18n(
  messages: Readonly<Record<Locale, Messages>>,
  initialLocale: Locale = DEFAULT_LOCALE,
): Translator {
  let locale = isLocale(initialLocale) ? initialLocale : DEFAULT_LOCALE;
  const listeners = new Set<() => void>();

  const t = (key: string, params?: TranslationParams): string => {
    const value = messages[locale][key] ?? messages[DEFAULT_LOCALE][key];
    if (value === undefined) {
      return key;
    }
    const template = typeof value === 'string' ? value : selectPlural(value, countOf(params), locale);
    return interpolate(template, params);
  };

  return {
    t,
    getLocale(): Locale {
      return locale;
    },
    setLocale(next: Locale): void {
      const resolved = isLocale(next) ? next : DEFAULT_LOCALE;
      if (resolved === locale) {
        return;
      }
      locale = resolved;
      listeners.forEach((listener) => listener());
    },
    subscribe(listener: () => void): () => void {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

function countOf(params?: TranslationParams): number | undefined {
  const count = params?.count;
  return typeof count === 'number' ? count : undefined;
}
