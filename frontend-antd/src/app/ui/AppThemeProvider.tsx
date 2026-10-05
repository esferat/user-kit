import { ConfigProvider, theme } from 'antd';
import enUS from 'antd/locale/en_US';
import ruRU from 'antd/locale/ru_RU';
import { useSyncExternalStore } from 'react';

import type { ThemeStore } from '@/features/theme-switch';
import type { Locale } from '@/shared/i18n';

import { useLocale } from '@/shared/i18n';

const ANTD_LOCALES = { ru: ruRU, en: enUS } as const;

/**
 * Ant Design has no global theme switch, so the colour scheme and the locale of
 * the components themselves are fed in here. The wrapper has to sit above the
 * login screen as well, because that one renders Ant Design components too.
 */
export interface AppThemeProviderProps {
  store: ThemeStore;
  children: React.ReactNode;
}

export function AppThemeProvider({ store, children }: AppThemeProviderProps) {
  const dark = useSyncExternalStore(store.subscribe, store.isDark, store.isDark);
  const locale = useLocale();

  return (
    <ConfigProvider
      locale={ANTD_LOCALES[locale as Locale & keyof typeof ANTD_LOCALES] ?? ruRU}
      theme={{
        algorithm: dark ? theme.darkAlgorithm : theme.defaultAlgorithm,
        token: { borderRadius: 6 },
      }}
    >
      {children}
    </ConfigProvider>
  );
}
