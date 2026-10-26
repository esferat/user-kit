import { useState, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { App, ConfigProvider } from 'antd';
import ruLocale from 'antd/locale/ru_RU';

/**
 * Провайдеры, которые нужны любому экрану профиля: локальные страницы этого
 * сервиса и та же форма, встроенная в frontend-main через Module Federation.
 *
 * Слой `shared` не знает о фичах — здесь только инфраструктурные контексты.
 * Андидация вложенных провайдеров безвредна, зато remote остаётся самодостаточным.
 */
export function AppProviders({ children }: { children: ReactNode }) {
  // Клиент на каждый рендер получает свой QueryClient, как того требует SSR.
  const [queryClient] = useState(
    () => new QueryClient({ defaultOptions: { queries: { retry: 1 } } }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      <ConfigProvider locale={ruLocale}>
        <App>{children}</App>
      </ConfigProvider>
    </QueryClientProvider>
  );
}
