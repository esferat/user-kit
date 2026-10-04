import { fireEvent, render } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { DARK_THEME, LIGHT_THEME } from '../model/themeStore';

import { ThemeSwitchButton } from './ThemeSwitchButton';

import type { ThemeStore } from '../model/themeStore';

import { i18n } from '@/shared/i18n';

function createStore(initial: string): ThemeStore {
  let theme = initial;
  const listeners = new Set<() => void>();
  return {
    current: () => theme,
    isDark: () => theme === DARK_THEME,
    apply: vi.fn(async () => theme),
    toggle: vi.fn(async () => {
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

function shellBarItem(container: HTMLElement): HTMLElement & { icon: string; text: string } {
  return container.querySelector('ui5-shellbar-item') as HTMLElement & { icon: string; text: string };
}

beforeEach(() => {
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
    expect(store.toggle).toHaveBeenCalledOnce();
  });
});
