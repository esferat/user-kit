export const THEME_STORAGE_KEY = 'user-kit-antd:theme';

export const LIGHT_THEME = 'light';
export const DARK_THEME = 'dark';

/**
 * Theme state of the shell bar, persisted in the local storage of the browser.
 *
 * Ant Design has no global theme switch of its own: the colour scheme is derived
 * from the `algorithm` of a `ConfigProvider`, so the store only owns the state
 * and the shell feeds it into that provider.
 */
export interface ThemeStore {
  current(): string;
  isDark(): boolean;
  /** Applies the stored theme, called once during the bootstrap. */
  apply(): string;
  toggle(): string;
  /** Notifies the shell bar item after every theme change. */
  subscribe(listener: () => void): () => void;
}

export function createThemeStore(defaultTheme: string, storage: Storage = window.localStorage): ThemeStore {
  let theme = storage.getItem(THEME_STORAGE_KEY) ?? defaultTheme;
  const listeners = new Set<() => void>();

  function apply(next: string): string {
    theme = next;
    storage.setItem(THEME_STORAGE_KEY, next);
    // The own styles of the shell follow the scheme through this attribute, so the
    // login screen repaints before React renders the first time.
    document.documentElement.dataset.theme = next;
    listeners.forEach((listener) => listener());
    return next;
  }

  return {
    current: () => theme,
    isDark: () => theme === DARK_THEME,
    apply() {
      return apply(theme);
    },
    toggle() {
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
