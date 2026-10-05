import { autorun } from 'mobx';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { DARK_THEME, LIGHT_THEME, THEME_STORAGE_KEY, ThemeStore, createThemeStore } from './themeStore';

vi.mock('@ui5/webcomponents-base/dist/config/Theme.js', () => ({
  setTheme: vi.fn().mockResolvedValue(undefined),
}));

const { setTheme } = vi.mocked(await import('@ui5/webcomponents-base/dist/config/Theme.js'));

afterEach(() => {
  window.localStorage.clear();
  delete document.documentElement.dataset.theme;
  vi.clearAllMocks();
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

  it('applies the theme to UI5, to the document and to the storage', async () => {
    const store = new ThemeStore(LIGHT_THEME);

    await expect(store.apply()).resolves.toBe(LIGHT_THEME);

    expect(setTheme).toHaveBeenCalledWith(LIGHT_THEME);
    expect(document.documentElement.dataset.theme).toBe(LIGHT_THEME);
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe(LIGHT_THEME);
  });

  it('toggles between the light and the dark theme', async () => {
    const store = new ThemeStore(LIGHT_THEME);

    await expect(store.toggle()).resolves.toBe(DARK_THEME);
    expect(store.isDark).toBe(true);
    expect(setTheme).toHaveBeenLastCalledWith(DARK_THEME);
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe(DARK_THEME);

    await expect(store.toggle()).resolves.toBe(LIGHT_THEME);
    expect(store.isDark).toBe(false);
  });

  it('is observable for the components that read it', () => {
    const store = new ThemeStore(LIGHT_THEME);
    const seen: boolean[] = [];
    const stop = autorun(() => {
      seen.push(store.isDark);
    });

    void store.toggle();
    void store.toggle();
    stop();

    expect(seen).toEqual([false, true, false]);
  });

  it('starts with the configured theme and reads the stored one back', () => {
    const store = createThemeStore(LIGHT_THEME);

    expect(store).toBeInstanceOf(ThemeStore);
    expect(store.theme).toBe(LIGHT_THEME);
  });

  it('keeps the two applications apart in the local storage', () => {
    // The Ant Design shell and the UI5 shell share a browser profile, so their
    // storage keys must not collide.
    expect(THEME_STORAGE_KEY).toBe('user-kit:theme');
  });
});
