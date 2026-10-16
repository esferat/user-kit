'use client';

import { App as AntApp, ConfigProvider } from 'antd';
import ruRU from 'antd/locale/ru_RU';
import { useState, type ReactNode } from 'react';

import { AuthSessionProvider, SessionStore, createAuthProvider } from '@/features/auth';
import { appConfig } from '@/shared/config';

/**
 * Клиентские провайдеры приложения: тема и локаль antd, контекст уведомлений и
 * стор сессии. Создаётся один раз на монтирование дерева.
 */
export function Providers({ children }: { children: ReactNode }) {
  const [store] = useState(() => new SessionStore(createAuthProvider(appConfig)));

  return (
    <ConfigProvider locale={ruRU}>
      <AntApp>
        <AuthSessionProvider store={store}>{children}</AuthSessionProvider>
      </AntApp>
    </ConfigProvider>
  );
}
