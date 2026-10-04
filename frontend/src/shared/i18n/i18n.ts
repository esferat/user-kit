export const LOCALES = ['ru', 'en'] as const;

export type Locale = (typeof LOCALES)[number];

/** Language used when the active locale has no message for a key. */
export const DEFAULT_LOCALE: Locale = 'ru';

/**
 * Message with a plural form per CLDR category. `few` and `many` are only used
 * by languages that need them, `other` is the mandatory fallback.
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
   * Registers a listener that is called after every locale change. `subscribe`
   * exists so that the React layer can follow the locale through
   * `useSyncExternalStore` instead of an own event mechanism.
   */
  subscribe(listener: () => void): () => void;
}

export function isLocale(value: unknown): value is Locale {
  return typeof value === 'string' && (LOCALES as readonly string[]).includes(value);
}

/**
 * Selects the CLDR plural category of a number. `Intl.PluralRules` covers every
 * supported language; the explicit branches keep the result predictable in
 * environments without full ICU data.
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

/** Replaces `{name}` placeholders; unknown placeholders are kept as they are. */
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
 * Creates a translator over a set of dictionaries. A key that is missing in the
 * active locale falls back to `defaultLocale` and finally to the key itself, so
 * a missing translation is visible but never breaks the application.
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
