import { setTheme } from '@ui5/webcomponents-base/dist/config/Theme.js';

export const THEME_STORAGE_KEY = 'user-kit:theme';

export const LIGHT_THEME = 'sap_horizon';
export const DARK_THEME = 'sap_horizon_dark';

/** Theme state of the shell bar, persisted in the local storage of the browser. */
export interface ThemeStore {
  current(): string;
  isDark(): boolean;
  /** Applies the stored theme to UI5, called once during the bootstrap. */
  apply(): Promise<string>;
  toggle(): Promise<string>;
  /** Notifies the shell bar item after every theme change. */
  subscribe(listener: () => void): () => void;
}

export function createThemeStore(defaultTheme: string, storage: Storage = window.localStorage): ThemeStore {
  let theme = storage.getItem(THEME_STORAGE_KEY) ?? defaultTheme;
  const listeners = new Set<() => void>();

  async function apply(next: string): Promise<string> {
    theme = next;
    storage.setItem(THEME_STORAGE_KEY, next);
    document.documentElement.dataset.theme = next;
    await setTheme(next);
    listeners.forEach((listener) => listener());
    return next;
  }

  return {
    current: () => theme,
    isDark: () => theme === DARK_THEME,
    async apply(): Promise<string> {
      return apply(theme);
    },
    async toggle(): Promise<string> {
      return apply(theme === DARK_THEME ? LIGHT_THEME : DARK_THEME);
    },
    subscribe(listener: () => void): () => void {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}
