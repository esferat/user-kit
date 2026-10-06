import { setTheme } from '@ui5/webcomponents-base/dist/config/Theme.js';
import { makeAutoObservable } from 'mobx';

export const THEME_STORAGE_KEY = 'user-kit:theme';

export const LIGHT_THEME = 'sap_horizon';
export const DARK_THEME = 'sap_horizon_dark';

/** Состояние темы shell bar, сохраняемое в local storage браузера. */
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

  /** Применяет сохранённую тему к UI5, вызывается один раз при запуске. */
  async apply(): Promise<string> {
    this.storage.setItem(THEME_STORAGE_KEY, this.theme);
    document.documentElement.dataset.theme = this.theme;
    await setTheme(this.theme);
    return this.theme;
  }

  async toggle(): Promise<string> {
    this.theme = this.isDark ? LIGHT_THEME : DARK_THEME;
    return this.apply();
  }
}

export function createThemeStore(defaultTheme: string, storage: Storage = window.localStorage): ThemeStore {
  return new ThemeStore(defaultTheme, storage);
}
