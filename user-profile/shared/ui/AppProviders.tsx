import { useState, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { App, ConfigProvider } from 'antd';
import ruLocale from 'antd/locale/ru_RU';

function createQueryClient(): QueryClient {
  return new QueryClient({ defaultOptions: { queries: { retry: 1 } } });
}

// `Symbol.for` живёт в реестре символов и переживает перезагрузку модуля (HMR):
// синглтон остаётся одним и тем же даже после горячей замены AppProviders.
const QUERY_CLIENT_KEY = Symbol.for('user-profile:query-client');

/**
 * Возвращает QueryClient браузера — один на весь бандл этого микрофронтенда.
 *
 * Все три exposes (`ProfilePage`, `ProfileEdit`, `ProfileAvatar`) грузятся из
 * одного графа модулей, поэтому делят этот клиент и, значит, кеш TanStack
 * Query. Из-за этого `invalidateQueries` после сохранения формы доходит до
 * аватара в шапке хоста и до карточки профиля без какой-либо шины в самой
 * вкладке. Клиент живёт до перезагрузки страницы.
 */
function sharedQueryClient(): QueryClient {
  const store = globalThis as unknown as Record<symbol, QueryClient | undefined>;
  store[QUERY_CLIENT_KEY] ??= createQueryClient();
  return store[QUERY_CLIENT_KEY] as QueryClient;
}

/**
 * Провайдеры, которые нужны любому экрану профиля: локальные страницы этого
 * сервиса и те же exposes, встроенные в frontend-main через Module Federation.
 *
 * Слой `shared` не знает о фичах — здесь только инфраструктурные контексты.
 * Андидация вложенных провайдеров безвредна, зато remote остаётся самодостаточным.
 *
 * QueryClient синглтонен только в браузере: на сервере состояние между
 * запросами делить нельзя, поэтому SSR-рендер получает свой клиент на каждый
 * запрос (требование TanStack Query для SSR).
 */
export function AppProviders({ children }: { children: ReactNode }) {
  const [serverClient] = useState(() =>
    typeof window === 'undefined' ? createQueryClient() : null,
  );
  const queryClient = serverClient ?? sharedQueryClient();

  return (
    <QueryClientProvider client={queryClient}>
      <ConfigProvider locale={ruLocale}>
        <App>{children}</App>
      </ConfigProvider>
    </QueryClientProvider>
  );
}
