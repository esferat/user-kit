import '@ui5/webcomponents-fiori/dist/ShellBarItem.js';

import type ShellBarItem from '@ui5/webcomponents-fiori/dist/ShellBarItem.js';

import type { ThemeStore } from '../model/themeStore';

import { t } from '@/shared/i18n';
import { ICONS } from '@/shared/ui';

/** Shell bar item that switches between the light and the dark UI5 theme. */
export function createThemeSwitchItem(store: ThemeStore): ShellBarItem {
  const item = document.createElement('ui5-shellbar-item') as ShellBarItem;

  const paint = (): void => {
    item.text = t(store.isDark() ? 'shell.theme.light' : 'shell.theme.dark');
    item.icon = store.isDark() ? ICONS.lightTheme : ICONS.darkTheme;
  };

  paint();

  item.addEventListener('item-click', () => {
    void store.toggle().then(paint);
  });

  return item;
}
