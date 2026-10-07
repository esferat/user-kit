import { useEffect, useMemo } from 'react';
import { Provider } from 'react-redux';

import { useAppDispatch, useAppSelector } from './model/hooks';
import { createAppStore } from './model/store';
import { useAppServices } from './model/useAppServices';
import { AppThemeProvider } from './ui/AppThemeProvider';
import { ThemeBootstrap } from './ui/ThemeBootstrap';

import type { AuthenticatedUser } from '@/entities/user';

import { AuthSessionProvider, logout, selectSession } from '@/features/auth';
import { DocumentsPage } from '@/pages/documents';
import { LoginPage } from '@/pages/login';
import { UsersPage } from '@/pages/users';
import { config as appConfig, type AppConfig } from '@/shared/config';
import { useRouteId, type Router } from '@/shared/lib';
import { resolveRoute, visibleNavEntries, AppShell } from '@/widgets/app-shell';

export interface AppProps {
  config?: AppConfig;
}

/** Страница администрирования доступна только с ролью admin. */
function PageOfRoute({ routeId }: { routeId: string }) {
  if (routeId === 'admin-users') {
    return <UsersPage />;
  }
  return <DocumentsPage />;
}

/** Shell со страницей маршрута, который пользователю разрешено открывать. */
function Shell({ user, routeId }: { user: AuthenticatedUser; routeId: string }) {
  const dispatch = useAppDispatch();

  return (
    <AppShell
      user={user}
      routeId={routeId}
      onLogout={() => {
        void dispatch(logout());
      }}
    >
      <PageOfRoute routeId={routeId} />
    </AppShell>
  );
}

/** Показывает экран входа или shell в зависимости от сессии. */
function Session({ config, router }: { config: AppConfig; router: Router }) {
  const routeId = useRouteId(router);
  const user = useAppSelector((state) => selectSession(state).user);
  const status = useAppSelector((state) => selectSession(state).status);

  if (user === null) {
    return status === 'restoring' ? null : <LoginPage config={config} />;
  }

  const allowedRoutes = visibleNavEntries(user).map((entry) => entry.id);

  return <Shell user={user} routeId={resolveRoute(routeId, allowedRoutes)} />;
}

/**
 * Корень композиции: читает конфигурацию, связывает вместе аутентификацию, API,
 * store, тему, роутер и shell и рендерит итоговое состояние.
 */
export function App({ config = appConfig }: AppProps) {
  const services = useAppServices(config);
  const store = useMemo(() => createAppStore({ services, theme: config.theme }), [services, config.theme]);

  useEffect(() => {
    services.router.start();
    return () => {
      services.router.stop();
    };
  }, [services.router]);

  return (
    <Provider store={store}>
      <AppThemeProvider>
        <ThemeBootstrap />
        <AuthSessionProvider services={services}>
          <Session config={config} router={services.router} />
        </AuthSessionProvider>
      </AppThemeProvider>
    </Provider>
  );
}
