import { fireEvent, render } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { DARK_THEME, LIGHT_THEME, createThemeStore } from '../model/themeStore';

import { ThemeSwitchButton } from './ThemeSwitchButton';

import type { ThemeStore } from '../model/themeStore';

import { i18n } from '@/shared/i18n';

function createStore(initial: string): ThemeStore {
  return createThemeStore(initial);
}

function shellBarItem(container: HTMLElement): HTMLElement & { icon: string; text: string } {
  return container.querySelector('ui5-shellbar-item') as HTMLElement & { icon: string; text: string };
}

beforeEach(() => {
  window.localStorage.clear();
  delete document.documentElement.dataset.theme;
  i18n.setLocale('ru');
});

describe('ThemeSwitchButton', () => {
  it('offers the dark theme while the light one is active', () => {
    const { container } = render(<ThemeSwitchButton store={createStore(LIGHT_THEME)} />);

    expect(shellBarItem(container).text).toBe(i18n.t('shell.theme.dark'));
    expect(shellBarItem(container).icon).toBe('dark-mode');
  });

  it('offers the light theme while the dark one is active', () => {
    const { container } = render(<ThemeSwitchButton store={createStore(DARK_THEME)} />);

    expect(shellBarItem(container).text).toBe(i18n.t('shell.theme.light'));
    expect(shellBarItem(container).icon).toBe('light-mode');
  });

  it('toggles the theme and repaints the item', async () => {
    const store = createStore(LIGHT_THEME);
    const { container } = render(<ThemeSwitchButton store={store} />);

    fireEvent.click(shellBarItem(container));

    await vi.waitFor(() => expect(shellBarItem(container).text).toBe(i18n.t('shell.theme.light')));
    expect(store.theme).toBe(DARK_THEME);
  });

  it('follows a theme that changed outside of the item', async () => {
    const store = createStore(LIGHT_THEME);
    const { container } = render(<ThemeSwitchButton store={store} />);

    void store.toggle();

    await vi.waitFor(() => expect(shellBarItem(container).text).toBe(i18n.t('shell.theme.light')));
  });
});
