import { configureStore } from '@reduxjs/toolkit';
import { beforeEach, describe, expect, it } from 'vitest';

import {
  commitTheme,
  createInitialThemeState,
  DARK_THEME,
  LIGHT_THEME,
  selectTheme,
  THEME_STORAGE_KEY,
  themeReducer,
  toTheme,
  toggleTheme,
} from './themeSlice';

function createStore() {
  return configureStore({ reducer: { theme: themeReducer } });
}

beforeEach(() => {
  window.localStorage.clear();
  delete document.documentElement.dataset.theme;
});

describe('themeSlice', () => {
  it('starts light without a stored choice', () => {
    const store = createStore();

    expect(selectTheme(store.getState()).theme).toBe(LIGHT_THEME);
  });

  it('starts with the theme of the configuration fallback', () => {
    const fallback = createInitialThemeState(DARK_THEME);

    expect(fallback.theme).toBe(DARK_THEME);
  });

  it('follows the stored choice of the previous visit', () => {
    window.localStorage.setItem(THEME_STORAGE_KEY, DARK_THEME);
    const store = createStore();

    expect(selectTheme(store.getState()).theme).toBe(DARK_THEME);
  });

  it('treats an unknown stored value as light', () => {
    expect(toTheme('sepia')).toBe(LIGHT_THEME);
  });

  it('toggles between the themes and persists the choice', () => {
    const store = createStore();
    store.dispatch(toggleTheme());

    expect(selectTheme(store.getState()).theme).toBe(DARK_THEME);
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe(DARK_THEME);
    expect(document.documentElement.dataset.theme).toBe(DARK_THEME);
  });

  it('commits the current theme to the document', () => {
    window.localStorage.setItem(THEME_STORAGE_KEY, DARK_THEME);
    const store = createStore();
    store.dispatch(commitTheme());

    expect(selectTheme(store.getState()).theme).toBe(DARK_THEME);
    expect(document.documentElement.dataset.theme).toBe(DARK_THEME);
  });
});
