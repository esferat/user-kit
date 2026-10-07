import { createSlice } from '@reduxjs/toolkit';

export const THEME_STORAGE_KEY = 'user-kit-mui:theme';

export const LIGHT_THEME = 'light';
export const DARK_THEME = 'dark';

export type Theme = typeof LIGHT_THEME | typeof DARK_THEME;

export interface ThemeState {
  theme: Theme;
}

/** Приводит значение к двум поддерживаемым темам; неизвестное значение — светлая. */
export function toTheme(value: string): Theme {
  return value === DARK_THEME || value === LIGHT_THEME ? value : LIGHT_THEME;
}

function readStored(): string | null {
  try {
    return window.localStorage.getItem(THEME_STORAGE_KEY);
  } catch {
    return null;
  }
}

function applyToDocument(theme: Theme): void {
  document.documentElement.dataset.theme = theme;
}

function persist(theme: Theme): void {
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // Браузер с отключённым хранилищем всё равно работает, выбор не сохраняется.
  }
}

/**
 * Начальное состояние темы: сохранённый выбор пользователя или тема
 * конфигурации сборки.
 */
export function createInitialThemeState(fallback: Theme = LIGHT_THEME): ThemeState {
  return { theme: toTheme(readStored() ?? fallback) };
}

/**
 * Слайс темы оболочки. Редьюсеры записывают выбор в local storage и в
 * атрибут документа следом за состоянием, потому что собственные стили
 * (и экран входа до первого рендера React) читают схему именно оттуда.
 */
export const themeSlice = createSlice({
  name: 'theme',
  // Инициализатор читает локальное хранилище в момент создания store,
  // а не в момент импорта модуля.
  initialState: createInitialThemeState,
  reducers: {
    /** Записывает уже выбранную тему в документ; вызывается один раз при запуске. */
    commitTheme(state) {
      persist(state.theme);
      applyToDocument(state.theme);
    },
    toggleTheme(state) {
      state.theme = state.theme === DARK_THEME ? LIGHT_THEME : DARK_THEME;
      persist(state.theme);
      applyToDocument(state.theme);
    },
  },
});

export const { commitTheme, toggleTheme } = themeSlice.actions;

export const themeReducer = themeSlice.reducer;

export function selectTheme(state: { theme: ThemeState }): ThemeState {
  return state.theme;
}
