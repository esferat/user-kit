import { Button } from 'antd';

import type { Locale } from '@/shared/i18n';

import { localeName, setLocale, useLocale, useTranslate } from '@/shared/i18n';

function nextLocale(current: Locale): Locale {
  return current === 'ru' ? 'en' : 'ru';
}

/**
 * Кнопка в шапке, переключающая интерфейс между доступными локалями. Каждый
 * компонент следует за i18n-стор, поэтому здесь ничего не нужно перерисовывать.
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
