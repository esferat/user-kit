import { useEffect } from 'react';

import { useAppServices } from './model/useAppServices';
import { AppThemeProvider } from './ui/AppThemeProvider';
import { ThemeBootstrap } from './ui/ThemeBootstrap';

import type { AppServices } from './model/useAppServices';

import type { AuthenticatedUser } from '@/entities/user';
import type { AuthSession } from '@/features/auth';

import { AuthSessionProvider, useAuthSession } from '@/features/auth';
import { DocumentsPage } from '@/pages/documents';
import { LoginPage } from '@/pages/login';
import { UsersPage } from '@/pages/users';
import { config as appConfig, type AppConfig } from '@/shared/config';
import { useRouteId } from '@/shared/lib';
import { resolveRoute, visibleNavEntries, AppShell } from '@/widgets/app-shell';

export interface AppProps {
  config?: AppConfig;
}

/** The administration page is only reachable with the admin role. */
function PageOfRoute({ routeId, services }: { routeId: string; services: AppServices }) {
  if (routeId === 'admin-users') {
    return <UsersPage userApi={services.userApi} />;
  }
  return <DocumentsPage fileApi={services.fileApi} />;
}

/** Shell with the page of the route the user is allowed to open. */
function Shell({
  user,
  routeId,
  services,
  session,
}: {
  user: AuthenticatedUser;
  routeId: string;
  services: AppServices;
  session: AuthSession;
}) {
  return (
    <AppShell
      user={user}
      routeId={routeId}
      themeStore={services.themeStore}
      onLogout={() => {
        void session.logout();
      }}
    >
      <PageOfRoute routeId={routeId} services={services} />
    </AppShell>
  );
}

/** Shows the login screen or the shell, depending on the session. */
function Session({ config, services }: { config: AppConfig; services: AppServices }) {
  const session = useAuthSession();
  const routeId = useRouteId(services.router);
  const user = session.user;

  if (user === null) {
    return session.status === 'restoring' ? null : <LoginPage config={config} />;
  }

  const allowedRoutes = visibleNavEntries(user).map((entry) => entry.id);

  return <Shell user={user} routeId={resolveRoute(routeId, allowedRoutes)} services={services} session={session} />;
}

/**
 * Composition root: reads the configuration, wires authentication, API, theme,
 * router and shell together and renders the state they end up in.
 */
export function App({ config = appConfig }: AppProps) {
  const services = useAppServices(config);

  useEffect(() => {
    services.router.start();
    return () => {
      services.router.stop();
    };
  }, [services.router]);

  return (
    <>
      <ThemeBootstrap store={services.themeStore} />
      <AppThemeProvider store={services.themeStore}>
        <AuthSessionProvider auth={services.auth}>
          <Session config={config} services={services} />
        </AuthSessionProvider>
      </AppThemeProvider>
    </>
  );
}
