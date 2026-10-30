'use client';

import { App as AntApp, ConfigProvider } from 'antd';
import ruRU from 'antd/locale/ru_RU';
import type { ReactNode } from 'react';

/**
 * Клиентские провайдеры приложения: тема и локаль antd, контекст уведомлений.
 * Сессии здесь нет — игры не ходят в API и не требуют входа.
 */
export function Providers({ children }: { children: ReactNode }) {
  return (
    <ConfigProvider locale={ruRU}>
      <AntApp>{children}</AntApp>
    </ConfigProvider>
  );
}
