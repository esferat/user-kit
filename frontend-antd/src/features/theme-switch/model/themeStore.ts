import { makeAutoObservable } from 'mobx';

export const THEME_STORAGE_KEY = 'user-kit-antd:theme';

export const LIGHT_THEME = 'light';
export const DARK_THEME = 'dark';

/**
 * Состояние темы shell bar, сохраняемое в local storage браузера.
 *
 * У Ant Design нет собственного глобального переключателя тем: цветовая схема
 * выводится из `algorithm` компонента `ConfigProvider`, поэтому стор владеет
 * только состоянием, а shell передаёт его в этот провайдер.
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

  /** Применяет сохранённую тему, вызывается один раз при запуске. */
  apply(): string {
    // Собственные стили shell следуют схеме через этот атрибут, поэтому
    // экран входа перерисовывается до первого рендера React.
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
