import { afterEach, describe, expect, it, vi } from 'vitest';

import { DARK_THEME, LIGHT_THEME, THEME_STORAGE_KEY, createThemeStore } from './themeStore';

vi.mock('@ui5/webcomponents-base/dist/config/Theme.js', () => ({
  setTheme: vi.fn().mockResolvedValue(undefined),
}));

afterEach(() => {
  window.localStorage.clear();
  delete document.documentElement.dataset.theme;
});

describe('createThemeStore', () => {
  it('starts with the configured theme', () => {
    const store = createThemeStore(LIGHT_THEME);

    expect(store.current()).toBe(LIGHT_THEME);
    expect(store.isDark()).toBe(false);
  });

  it('prefers the stored theme over the default', () => {
    window.localStorage.setItem(THEME_STORAGE_KEY, DARK_THEME);

    const store = createThemeStore(LIGHT_THEME);

    expect(store.current()).toBe(DARK_THEME);
    expect(store.isDark()).toBe(true);
  });

  it('applies the theme to the document and to the storage', async () => {
    const store = createThemeStore(LIGHT_THEME);

    await store.apply();

    expect(document.documentElement.dataset.theme).toBe(LIGHT_THEME);
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe(LIGHT_THEME);
  });

  it('toggles between the light and the dark theme', async () => {
    const store = createThemeStore(LIGHT_THEME);

    await expect(store.toggle()).resolves.toBe(DARK_THEME);
    expect(store.isDark()).toBe(true);
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe(DARK_THEME);

    await expect(store.toggle()).resolves.toBe(LIGHT_THEME);
    expect(store.isDark()).toBe(false);
  });
});
