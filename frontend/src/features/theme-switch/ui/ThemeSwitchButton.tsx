import { ShellBarItem } from '@ui5/webcomponents-react/ShellBarItem';
import { useSyncExternalStore } from 'react';

import type { ThemeStore } from '../model/themeStore';

import { useTranslate } from '@/shared/i18n';
import { ICONS } from '@/shared/ui';

export interface ThemeSwitchButtonProps {
  store: ThemeStore;
}

/** Shell bar item that switches between the light and the dark UI5 theme. */
export function ThemeSwitchButton({ store }: ThemeSwitchButtonProps) {
  const t = useTranslate();
  const dark = useSyncExternalStore(store.subscribe, store.isDark, store.isDark);

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
