import { Button } from 'antd';
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
  const label = t(dark ? 'shell.theme.light' : 'shell.theme.dark');

  return (
    <Button
      type="text"
      aria-label={label}
      title={label}
      icon={dark ? <ICONS.lightTheme /> : <ICONS.darkTheme />}
      onClick={() => {
        store.toggle();
      }}
    />
  );
}

/** Кнопка в шапке, переключающая между светлой и тёмной темой Ant Design. */
export const ThemeSwitchButton = observer(ThemeSwitchButtonView);
