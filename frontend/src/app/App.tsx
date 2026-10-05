import { observer } from 'mobx-react-lite';
import { useEffect } from 'react';

import { useAppServices } from './model/useAppServices';
import { ThemeBootstrap } from './ui/ThemeBootstrap';

import type { AppServices } from './model/useAppServices';

import type { AuthenticatedUser } from '@/entities/user';

import { AuthSessionProvider } from '@/features/auth';
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
    return <UsersPage store={services.usersStore} />;
  }
  return <DocumentsPage store={services.filesStore} />;
}

/** Shell with the page of the route the user is allowed to open. */
function Shell({ user, routeId, services }: { user: AuthenticatedUser; routeId: string; services: AppServices }) {
  return (
    <AppShell
      user={user}
      routeId={routeId}
      themeStore={services.themeStore}
      onLogout={() => {
        void services.session.logout();
      }}
    >
      <PageOfRoute routeId={routeId} services={services} />
    </AppShell>
  );
}

/** Shows the login screen or the shell, depending on the session. */
const Session = observer(function Session({ config, services }: { config: AppConfig; services: AppServices }) {
  const routeId = useRouteId(services.router);
  const user = services.session.user;

  if (user === null) {
    return services.session.status === 'restoring' ? null : <LoginPage config={config} />;
  }

  const allowedRoutes = visibleNavEntries(user).map((entry) => entry.id);

  return <Shell user={user} routeId={resolveRoute(routeId, allowedRoutes)} services={services} />;
});

/**
 * Composition root: reads the configuration, wires authentication, API, stores,
 * theme, router and shell together and renders the state they end up in.
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
      <AuthSessionProvider store={services.session}>
        <Session config={config} services={services} />
      </AuthSessionProvider>
    </>
  );
}
