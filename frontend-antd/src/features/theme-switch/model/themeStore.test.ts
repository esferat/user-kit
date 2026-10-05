import { afterEach, describe, expect, it } from 'vitest';

import { DARK_THEME, LIGHT_THEME, THEME_STORAGE_KEY, createThemeStore } from './themeStore';

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

  it('applies the theme to the document and to the storage', () => {
    const store = createThemeStore(LIGHT_THEME);

    store.apply();

    expect(document.documentElement.dataset.theme).toBe(LIGHT_THEME);
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe(LIGHT_THEME);
  });

  it('toggles between the light and the dark theme', () => {
    const store = createThemeStore(LIGHT_THEME);

    expect(store.toggle()).toBe(DARK_THEME);
    expect(store.isDark()).toBe(true);
    expect(document.documentElement.dataset.theme).toBe(DARK_THEME);

    expect(store.toggle()).toBe(LIGHT_THEME);
    expect(store.isDark()).toBe(false);
  });

  it('notifies the subscribers until they unsubscribe', () => {
    const store = createThemeStore(LIGHT_THEME);
    let changes = 0;
    const unsubscribe = store.subscribe(() => {
      changes += 1;
    });

    store.toggle();
    unsubscribe();
    store.toggle();

    expect(changes).toBe(1);
  });

  it('keeps the two applications apart in the local storage', () => {
    // The Ant Design shell and the UI5 shell share a browser profile, so their
    // storage keys must not collide.
    expect(THEME_STORAGE_KEY).toBe('user-kit-antd:theme');
  });
});
