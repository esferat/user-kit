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

/** Header button that switches between the light and the dark Ant Design theme. */
export const ThemeSwitchButton = observer(ThemeSwitchButtonView);
