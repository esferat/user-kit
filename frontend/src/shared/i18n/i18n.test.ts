import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { createI18n, interpolate, isLocale, pluralCategory, type Messages } from './i18n';

import { getLocale, i18n, localeName, localeOfTag, MESSAGES, resolveInitialLocale, setLocale, t } from './index';

const FALLBACK_LOCALE = 'ru';

beforeEach(() => {
  i18n.setLocale(FALLBACK_LOCALE);
});

afterEach(() => {
  window.localStorage.clear();
  i18n.setLocale(FALLBACK_LOCALE);
});

describe('isLocale / localeOfTag', () => {
  it('accepts supported locales only', () => {
    expect(isLocale('ru')).toBe(true);
    expect(isLocale('en')).toBe(true);
    expect(isLocale('de')).toBe(false);
    expect(isLocale(undefined)).toBe(false);
  });

  it('reduces a language tag onto its primary subtag', () => {
    expect(localeOfTag('en-GB')).toBe('en');
    expect(localeOfTag('ru_RU')).toBe('ru');
    expect(localeOfTag('de-DE')).toBeUndefined();
    expect(localeOfTag(null)).toBeUndefined();
  });
});

describe('resolveInitialLocale', () => {
  it('prefers the stored choice over the browser and the default', () => {
    expect(resolveInitialLocale({ stored: 'en', browser: 'ru-RU', fallback: 'ru' })).toBe('en');
  });

  it('falls back to the browser language and then to the default', () => {
    expect(resolveInitialLocale({ stored: null, browser: 'ru-RU', fallback: 'en' })).toBe('ru');
    expect(resolveInitialLocale({ stored: '', browser: null, fallback: 'en' })).toBe('en');
  });

  it('ends up on russian when nothing matches', () => {
    expect(resolveInitialLocale({ stored: 'de', browser: 'fr', fallback: 'it' })).toBe('ru');
  });
});

describe('pluralCategory', () => {
  it('knows the russian categories', () => {
    expect(pluralCategory(1, 'ru')).toBe('one');
    expect(pluralCategory(2, 'ru')).toBe('few');
    expect(pluralCategory(5, 'ru')).toBe('many');
    expect(pluralCategory(11, 'ru')).toBe('many');
    expect(pluralCategory(21, 'ru')).toBe('one');
    expect(pluralCategory(0, 'ru')).toBe('many');
  });

  it('knows the english categories', () => {
    expect(pluralCategory(1, 'en')).toBe('one');
    expect(pluralCategory(2, 'en')).toBe('other');
    expect(pluralCategory(0, 'en')).toBe('other');
  });
});

describe('interpolate', () => {
  it('replaces known placeholders and keeps unknown ones', () => {
    expect(interpolate('Файл «{name}» удалён', { name: 'a.txt' })).toBe('Файл «a.txt» удалён');
    expect(interpolate('{count} из {total}', { count: 1 })).toBe('1 из {total}');
    expect(interpolate('без параметров')).toBe('без параметров');
  });
});

describe('createI18n', () => {
  const messages: Record<'ru' | 'en', Messages> = {
    ru: {
      greeting: 'Привет',
      files: { one: '{count} файл', few: '{count} файла', many: '{count} файлов', other: '{count} файла' },
    },
    en: { greeting: 'Hello' },
  };

  it('translates into the active locale', () => {
    const translator = createI18n(messages, 'en');
    expect(translator.t('greeting')).toBe('Hello');
    expect(translator.getLocale()).toBe('en');
  });

  it('falls back to the default locale and then to the key', () => {
    const translator = createI18n(messages, 'en');
    expect(translator.t('files', { count: 1 })).toBe('1 файл');
    expect(translator.t('missing.key')).toBe('missing.key');
  });

  it('switches the locale at runtime', () => {
    const translator = createI18n(messages, 'ru');
    expect(translator.t('greeting')).toBe('Привет');
    translator.setLocale('en');
    expect(translator.t('greeting')).toBe('Hello');
  });

  it('ignores an unknown locale', () => {
    const translator = createI18n(messages, 'ru');
    translator.setLocale('de' as 'ru');
    expect(translator.getLocale()).toBe('ru');
  });
});

describe('the active translator', () => {
  it('translates the interface and switches the language', () => {
    expect(getLocale()).toBe('ru');
    expect(t('nav.documents')).toBe('Документы');

    setLocale('en');

    expect(getLocale()).toBe('en');
    expect(t('nav.documents')).toBe('Documents');
    expect(document.documentElement.lang).toBe('en');
    expect(window.localStorage.getItem('user-kit:locale')).toBe('en');
  });

  it('uses the singular form for one file and the plural form for many', () => {
    expect(t('documents.message.uploaded', { count: 1 })).toBe('Загружен 1 файл');
    expect(t('documents.message.uploaded', { count: 3 })).toBe('Загружено 3 файла');
    expect(t('documents.message.uploaded', { count: 7 })).toBe('Загружено 7 файлов');
  });

  it('names every locale in its own language', () => {
    expect(localeName('ru')).toBe('Русский');
    expect(localeName('en')).toBe('English');
  });
});

describe('the dictionaries', () => {
  it('contain exactly the same keys in every locale', () => {
    const keys = (locale: 'ru' | 'en'): string[] => Object.keys(MESSAGES[locale]).sort();

    const missingInEnglish = keys('ru').filter((key) => !keys('en').includes(key));
    const missingInRussian = keys('en').filter((key) => !keys('ru').includes(key));

    expect(missingInEnglish).toEqual([]);
    expect(missingInRussian).toEqual([]);
  });

  it('defines no empty message', () => {
    Object.entries(MESSAGES).forEach(([locale, messages]) => {
      Object.entries(messages).forEach(([key, value]) => {
        const template = typeof value === 'string' ? value : Object.values(value).join('');
        expect(template.length, `${locale}:${key}`).toBeGreaterThan(0);
      });
    });
  });
});
