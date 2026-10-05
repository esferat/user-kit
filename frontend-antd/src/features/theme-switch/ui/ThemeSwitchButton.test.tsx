import { fireEvent, render } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { DARK_THEME, LIGHT_THEME } from '../model/themeStore';

import { ThemeSwitchButton } from './ThemeSwitchButton';

import type { ThemeStore } from '../model/themeStore';

import { i18n, setLocale } from '@/shared/i18n';

function createStore(initial: string): ThemeStore {
  let theme = initial;
  const listeners = new Set<() => void>();
  return {
    current: () => theme,
    isDark: () => theme === DARK_THEME,
    apply: vi.fn(() => theme),
    toggle: vi.fn(() => {
      theme = theme === DARK_THEME ? LIGHT_THEME : DARK_THEME;
      listeners.forEach((listener) => listener());
      return theme;
    }),
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

function switchButton(container: HTMLElement): HTMLElement {
  return container.querySelector('button') as HTMLElement;
}

beforeEach(() => {
  i18n.setLocale('ru');
});

describe('ThemeSwitchButton', () => {
  it('offers the dark theme while the light one is active', () => {
    const { container } = render(<ThemeSwitchButton store={createStore(LIGHT_THEME)} />);

    expect(switchButton(container).getAttribute('aria-label')).toBe(i18n.t('shell.theme.dark'));
    expect(switchButton(container).querySelector('.anticon-moon')?.getAttribute('aria-label')).toBe('moon');
  });

  it('offers the light theme while the dark one is active', () => {
    const { container } = render(<ThemeSwitchButton store={createStore(DARK_THEME)} />);

    expect(switchButton(container).getAttribute('aria-label')).toBe(i18n.t('shell.theme.light'));
    expect(switchButton(container).querySelector('.anticon-sun')?.getAttribute('aria-label')).toBe('sun');
  });

  it('toggles the theme and repaints the button', async () => {
    const store = createStore(LIGHT_THEME);
    const { container } = render(<ThemeSwitchButton store={store} />);

    fireEvent.click(switchButton(container));

    await vi.waitFor(() =>
      expect(switchButton(container).getAttribute('aria-label')).toBe(i18n.t('shell.theme.light')),
    );
    expect(store.toggle).toHaveBeenCalledOnce();
  });

  it('follows the interface language', async () => {
    const { container } = render(<ThemeSwitchButton store={createStore(LIGHT_THEME)} />);

    setLocale('en');

    await vi.waitFor(() => expect(switchButton(container).getAttribute('aria-label')).toBe('Dark theme'));
  });
});
