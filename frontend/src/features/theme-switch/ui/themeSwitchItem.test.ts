import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { ThemeStore } from '../model/themeStore';

import { i18n } from '@/shared/i18n';
import { ICONS } from '@/shared/ui';

import { createThemeSwitchItem } from './themeSwitchItem';

function createStore(theme: string): ThemeStore {
  return {
    current: () => theme,
    isDark: () => theme === 'sap_horizon_dark',
    apply: vi.fn(async () => theme),
    toggle: vi.fn(async () => 'sap_horizon'),
  };
}

describe('createThemeSwitchItem', () => {
  beforeEach(() => {
    i18n.setLocale('ru');
  });

  it('offers the dark theme while the light theme is active', () => {
    const item = createThemeSwitchItem(createStore('sap_horizon'));

    expect(item.tagName.toLowerCase()).toBe('ui5-shellbar-item');
    expect(item.icon).toBe(ICONS.darkTheme);
    expect(item.text).toBe(i18n.t('shell.theme.dark'));
  });

  it('offers the light theme while the dark theme is active', () => {
    const item = createThemeSwitchItem(createStore('sap_horizon_dark'));

    expect(item.icon).toBe(ICONS.lightTheme);
    expect(item.text).toBe(i18n.t('shell.theme.light'));
  });

  it('toggles the theme and repaints itself', async () => {
    const store = createStore('sap_horizon');
    const item = createThemeSwitchItem(store);

    item.dispatchEvent(new CustomEvent('item-click'));
    await vi.waitFor(() => expect(store.toggle).toHaveBeenCalledOnce());

    await vi.waitFor(() => expect(item.icon).toBe(ICONS.lightTheme));
  });
});
