import { Button } from 'antd';

import type { Locale } from '@/shared/i18n';

import { localeName, setLocale, useLocale, useTranslate } from '@/shared/i18n';

function nextLocale(current: Locale): Locale {
  return current === 'ru' ? 'en' : 'ru';
}

/**
 * Header button that switches the interface between the available locales. Every
 * component follows through the i18n store, so nothing has to repaint here.
 */
export function LocaleSwitchButton() {
  const t = useTranslate();
  const locale = useLocale();
  const label = t('locale.switchTo', { locale: localeName(nextLocale(locale)) });

  return (
    <Button
      type="text"
      aria-label={label}
      title={label}
      onClick={() => {
        setLocale(nextLocale(locale));
      }}
    >
      {t('locale.name')}
    </Button>
  );
}
