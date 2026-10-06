import { ShellBarItem } from '@ui5/webcomponents-react/ShellBarItem';
import { observer } from 'mobx-react-lite';

import type { ThemeStore } from '../model/themeStore';

import { useTranslate } from '@/shared/i18n';
import { ICONS } from '@/shared/ui';

export interface ThemeSwitchButtonProps {
  store: ThemeStore;
}

function ThemeSwitchButtonView({ store }: ThemeSwitchButtonProps) {
  const t = useTranslate();
  const dark = store.isDark;

  return (
    <ShellBarItem
      icon={dark ? ICONS.lightTheme : ICONS.darkTheme}
      text={t(dark ? 'shell.theme.light' : 'shell.theme.dark')}
      onClick={() => {
        void store.toggle();
      }}
    />
  );
}

/** Элемент shell bar, переключающий между светлой и тёмной темой UI5. */
export const ThemeSwitchButton = observer(ThemeSwitchButtonView);
