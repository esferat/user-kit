import { ConfigProvider, theme } from 'antd';
import enUS from 'antd/locale/en_US';
import ruRU from 'antd/locale/ru_RU';
import { observer } from 'mobx-react-lite';

import type { ThemeStore } from '@/features/theme-switch';
import type { Locale } from '@/shared/i18n';

import { useLocale } from '@/shared/i18n';

const ANTD_LOCALES = { ru: ruRU, en: enUS } as const;

/**
 * У Ant Design нет глобального переключателя темы, поэтому здесь задаются
 * цветовая схема и locale самих компонентов. Обёртка должна быть и выше экрана
 * входа, потому что тот тоже рендерит компоненты Ant Design.
 */
export interface AppThemeProviderProps {
  store: ThemeStore;
  children: React.ReactNode;
}

function AppThemeProviderView({ store, children }: AppThemeProviderProps) {
  const locale = useLocale();

  return (
    <ConfigProvider
      locale={ANTD_LOCALES[locale as Locale & keyof typeof ANTD_LOCALES] ?? ruRU}
      theme={{
        algorithm: store.isDark ? theme.darkAlgorithm : theme.defaultAlgorithm,
        token: { borderRadius: 6 },
      }}
    >
      {children}
    </ConfigProvider>
  );
}

export const AppThemeProvider = observer(AppThemeProviderView);
