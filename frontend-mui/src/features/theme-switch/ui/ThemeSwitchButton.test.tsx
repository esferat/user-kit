import { configureStore } from '@reduxjs/toolkit';
import { fireEvent, render } from '@testing-library/react';
import { Provider } from 'react-redux';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { DARK_THEME, LIGHT_THEME, selectTheme, themeReducer, toggleTheme, type Theme } from '../model/themeSlice';

import { ThemeSwitchButton } from './ThemeSwitchButton';

import { i18n, setLocale } from '@/shared/i18n';

function createStore(theme: Theme) {
  return configureStore({ reducer: { theme: themeReducer }, preloadedState: { theme: { theme } } });
}

function switchButton(container: HTMLElement): HTMLElement {
  return container.querySelector('button') as HTMLElement;
}

function renderButton(theme: Theme = LIGHT_THEME) {
  const store = createStore(theme);
  const view = render(
    <Provider store={store}>
      <ThemeSwitchButton />
    </Provider>,
  );
  return { ...view, store };
}

beforeEach(() => {
  window.localStorage.clear();
  delete document.documentElement.dataset.theme;
  i18n.setLocale('ru');
});

describe('ThemeSwitchButton', () => {
  it('offers the dark theme while the light one is active', () => {
    const { container } = renderButton(LIGHT_THEME);

    expect(switchButton(container).getAttribute('aria-label')).toBe(i18n.t('shell.theme.dark'));
  });

  it('offers the light theme while the dark one is active', () => {
    const { container } = renderButton(DARK_THEME);

    expect(switchButton(container).getAttribute('aria-label')).toBe(i18n.t('shell.theme.light'));
  });

  it('toggles the theme and repaints the button', async () => {
    const { container, store } = renderButton(LIGHT_THEME);

    fireEvent.click(switchButton(container));

    await vi.waitFor(() =>
      expect(switchButton(container).getAttribute('aria-label')).toBe(i18n.t('shell.theme.light')),
    );
    expect(selectTheme(store.getState()).theme).toBe(DARK_THEME);
    expect(window.localStorage.getItem('user-kit-mui:theme')).toBe(DARK_THEME);
  });

  it('follows a theme that changed outside of the button', async () => {
    const { container, store } = renderButton(LIGHT_THEME);

    store.dispatch(toggleTheme());

    await vi.waitFor(() =>
      expect(switchButton(container).getAttribute('aria-label')).toBe(i18n.t('shell.theme.light')),
    );
  });

  it('follows the interface language', async () => {
    const { container } = renderButton(LIGHT_THEME);

    setLocale('en');

    await vi.waitFor(() => expect(switchButton(container).getAttribute('aria-label')).toBe('Dark theme'));
  });
});
