import { autorun } from 'mobx';
import { afterEach, describe, expect, it } from 'vitest';

import { DARK_THEME, LIGHT_THEME, THEME_STORAGE_KEY, ThemeStore, createThemeStore } from './themeStore';

afterEach(() => {
  window.localStorage.clear();
  delete document.documentElement.dataset.theme;
});

describe('ThemeStore', () => {
  it('starts with the configured theme', () => {
    const store = new ThemeStore(LIGHT_THEME);

    expect(store.theme).toBe(LIGHT_THEME);
    expect(store.isDark).toBe(false);
  });

  it('prefers the stored theme over the default', () => {
    window.localStorage.setItem(THEME_STORAGE_KEY, DARK_THEME);

    const store = new ThemeStore(LIGHT_THEME);

    expect(store.theme).toBe(DARK_THEME);
    expect(store.isDark).toBe(true);
  });

  it('applies the theme to the document and to the storage', () => {
    const store = new ThemeStore(LIGHT_THEME);

    store.apply();

    expect(document.documentElement.dataset.theme).toBe(LIGHT_THEME);
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe(LIGHT_THEME);
  });

  it('toggles between the light and the dark theme', () => {
    const store = new ThemeStore(LIGHT_THEME);

    expect(store.toggle()).toBe(DARK_THEME);
    expect(store.isDark).toBe(true);
    expect(document.documentElement.dataset.theme).toBe(DARK_THEME);

    expect(store.toggle()).toBe(LIGHT_THEME);
    expect(store.isDark).toBe(false);
  });

  it('is observable for the components that read it', () => {
    const store = new ThemeStore(LIGHT_THEME);
    const seen: boolean[] = [];
    const stop = autorun(() => {
      seen.push(store.isDark);
    });

    store.toggle();
    store.toggle();
    stop();

    expect(seen).toEqual([false, true, false]);
  });

  it('starts with the configured theme and reads the stored one back', () => {
    const store = createThemeStore(LIGHT_THEME);

    expect(store).toBeInstanceOf(ThemeStore);
    expect(store.theme).toBe(LIGHT_THEME);
  });

  it('keeps the two applications apart in the local storage', () => {
    // Ant Design shell и UI5 shell используют один профиль браузера, поэтому
    // их ключи хранилища не должны совпадать.
    expect(THEME_STORAGE_KEY).toBe('user-kit-antd:theme');
  });
});
