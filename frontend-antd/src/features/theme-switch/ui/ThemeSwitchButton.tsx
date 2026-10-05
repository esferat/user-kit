import { Button } from 'antd';
import { useSyncExternalStore } from 'react';

import type { ThemeStore } from '../model/themeStore';

import { useTranslate } from '@/shared/i18n';
import { ICONS } from '@/shared/ui';

export interface ThemeSwitchButtonProps {
  store: ThemeStore;
}

/** Header button that switches between the light and the dark Ant Design theme. */
export function ThemeSwitchButton({ store }: ThemeSwitchButtonProps) {
  const t = useTranslate();
  const dark = useSyncExternalStore(store.subscribe, store.isDark, store.isDark);
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
