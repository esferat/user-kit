import '@ui5/webcomponents-fiori/dist/ShellBarItem.js';

import type ShellBarItem from '@ui5/webcomponents-fiori/dist/ShellBarItem.js';

import { getLocale, localeName, LOCALES, setLocale, t, type Locale } from '@/shared/i18n';

function nextLocale(): Locale {
  const index = LOCALES.indexOf(getLocale());
  return LOCALES[(index + 1) % LOCALES.length];
}

/** Shell bar item that switches the interface between the available locales. */
export function createLocaleSwitchItem(onChanged: () => void): ShellBarItem {
  const item = document.createElement('ui5-shellbar-item') as ShellBarItem;

  const paint = (): void => {
    item.text = t('locale.name');
    item.setAttribute('title', t('locale.switchTo', { locale: localeName(nextLocale()) }));
  };

  paint();

  item.addEventListener('item-click', () => {
    setLocale(nextLocale());
    paint();
    onChanged();
  });

  return item;
}
