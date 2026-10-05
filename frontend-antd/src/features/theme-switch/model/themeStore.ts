import { makeAutoObservable } from 'mobx';

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
export class ThemeStore {
  theme: string;

  private readonly storage: Storage;

  constructor(defaultTheme: string, storage: Storage = window.localStorage) {
    this.storage = storage;
    this.theme = storage.getItem(THEME_STORAGE_KEY) ?? defaultTheme;
    makeAutoObservable<ThemeStore, 'storage'>(this, { storage: false }, { autoBind: true });
  }

  get isDark(): boolean {
    return this.theme === DARK_THEME;
  }

  /** Applies the stored theme, called once during the bootstrap. */
  apply(): string {
    // The own styles of the shell follow the scheme through this attribute, so
    // the login screen repaints before React renders the first time.
    this.storage.setItem(THEME_STORAGE_KEY, this.theme);
    document.documentElement.dataset.theme = this.theme;
    return this.theme;
  }

  toggle(): string {
    this.theme = this.isDark ? LIGHT_THEME : DARK_THEME;
    this.storage.setItem(THEME_STORAGE_KEY, this.theme);
    document.documentElement.dataset.theme = this.theme;
    return this.theme;
  }
}

export function createThemeStore(defaultTheme: string, storage: Storage = window.localStorage): ThemeStore {
  return new ThemeStore(defaultTheme, storage);
}
