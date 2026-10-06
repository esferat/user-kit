import { ShellBarItem } from '@ui5/webcomponents-react/ShellBarItem';

import type { Locale } from '@/shared/i18n';

import { localeName, setLocale, useLocale, useTranslate } from '@/shared/i18n';

function nextLocale(current: Locale): Locale {
  return current === 'ru' ? 'en' : 'ru';
}

/**
 * Элемент shell bar, который переключает интерфейс между доступными локалями.
 * Каждый компонент следует за i18n-стор, поэтому здесь ничего не нужно перерисовывать.
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
