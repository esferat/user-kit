import { ShellBarItem } from '@ui5/webcomponents-react/ShellBarItem';

import type { Locale } from '@/shared/i18n';

import { localeName, setLocale, useLocale, useTranslate } from '@/shared/i18n';

function nextLocale(current: Locale): Locale {
  return current === 'ru' ? 'en' : 'ru';
}

/**
 * Shell bar item that switches the interface between the available locales.
 * Every component follows through the i18n store, so nothing has to repaint here.
 */
export function LocaleSwitchButton() {
  const t = useTranslate();
  const locale = useLocale();

  return (
    <ShellBarItem
      text={t('locale.name')}
      title={t('locale.switchTo', { locale: localeName(nextLocale(locale)) })}
      onClick={() => {
        setLocale(nextLocale(locale));
      }}
    />
  );
}
