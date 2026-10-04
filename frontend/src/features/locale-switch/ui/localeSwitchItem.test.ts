import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { getLocale, i18n, LOCALES } from '@/shared/i18n';

import { createLocaleSwitchItem } from './localeSwitchItem';

describe('createLocaleSwitchItem', () => {
  const onChanged = vi.fn();

  beforeEach(() => {
    window.localStorage.clear();
    i18n.setLocale('ru');
    onChanged.mockClear();
  });

  afterEach(() => {
    window.localStorage.clear();
    i18n.setLocale('ru');
  });

  it('names the current language and announces the next one', () => {
    const item = createLocaleSwitchItem(onChanged);

    expect(item.tagName.toLowerCase()).toBe('ui5-shellbar-item');
    expect(item.text).toBe(i18n.t('locale.name'));
    expect(item.getAttribute('title')).toBe(i18n.t('locale.switchTo', { locale: 'English' }));
  });

  it('switches to the next language, repaints and notifies the shell', () => {
    const item = createLocaleSwitchItem(onChanged);
    const next = LOCALES[(LOCALES.indexOf(getLocale()) + 1) % LOCALES.length];

    item.dispatchEvent(new CustomEvent('item-click'));

    expect(getLocale()).toBe(next);
    expect(item.text).toBe(i18n.t('locale.name'));
    expect(item.getAttribute('title')).toBe(i18n.t('locale.switchTo', { locale: 'Русский' }));
    expect(onChanged).toHaveBeenCalledOnce();
  });

  it('cycles through all locales', () => {
    const item = createLocaleSwitchItem(onChanged);

    for (let index = 0; index < LOCALES.length; index += 1) {
      item.dispatchEvent(new CustomEvent('item-click'));
    }

    expect(getLocale()).toBe('ru');
    expect(onChanged).toHaveBeenCalledTimes(LOCALES.length);
  });
});
