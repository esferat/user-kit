import { Button } from '@mui/material';

import type { Locale } from '@/shared/i18n';

import { localeName, setLocale, useLocale, useTranslate } from '@/shared/i18n';

function nextLocale(current: Locale): Locale {
  return current === 'ru' ? 'en' : 'ru';
}

/**
 * Кнопка в шапке, переключающая интерфейс между доступными локалями.
 * Локали хватает подписки каждого компонента на смену языка.
 */
export function LocaleSwitchButton() {
  const t = useTranslate();
  const locale = useLocale();
  const label = t('locale.switchTo', { locale: localeName(nextLocale(locale)) });

  return (
    <Button
      color="inherit"
      size="medium"
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
