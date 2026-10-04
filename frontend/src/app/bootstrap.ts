import { createPageRenderer, prependLoginMessage, renderLoginPage } from './routeRenderer';

import { createFileApi, FILE_QUERYABLE_PROPERTIES } from '@/entities/file';
import { createUserApi, USER_QUERYABLE_PROPERTIES, type AuthenticatedUser } from '@/entities/user';
import { createAuthProvider } from '@/features/auth';
import { createThemeStore } from '@/features/theme-switch';
import { ODataClient } from '@/shared/api';
import { config as appConfig, type AppConfig } from '@/shared/config';
import { applyLanguage, t } from '@/shared/i18n';
import { createRouter, messageOfError } from '@/shared/lib';
import { createAppShell } from '@/widgets/app-shell';

/**
 * Composition root: reads the configuration, wires authentication, API, theme,
 * router and shell together and hands the result to the given root element.
 */
export async function bootstrap(root: HTMLElement, config: AppConfig = appConfig): Promise<void> {
  applyLanguage();

  const auth = createAuthProvider(config);
  const router = createRouter();
  const getAccessToken = (): Promise<string | null> => auth.getAccessToken();

  const odata = new ODataClient({
    baseUrl: config.apiBaseUrl,
    getAccessToken,
    queryableProperties: {
      Files: FILE_QUERYABLE_PROPERTIES,
      Users: USER_QUERYABLE_PROPERTIES,
    },
  });
  const fileApi = createFileApi({ baseUrl: config.apiBaseUrl, odata, getAccessToken });
  const userApi = createUserApi({ baseUrl: config.apiBaseUrl, odata, getAccessToken });

  const themeStore = createThemeStore(config.theme);
  await themeStore.apply();

  let unsubscribeRoute: (() => void) | null = null;

  const stopRouting = (): void => {
    unsubscribeRoute?.();
    unsubscribeRoute = null;
  };

  const renderShell = (user: AuthenticatedUser): void => {
    const renderer = createPageRenderer();
    const context = renderer.create(fileApi, userApi);

    const shell = createAppShell({
      user,
      auth,
      themeStore,
      onLocaleChanged: () => {
        renderShell(user);
      },
      renderContent: (host, routeId) => {
        host.replaceChildren(renderer.render(routeId, context));
      },
    });

    stopRouting();
    unsubscribeRoute = router.onRoute((route) => {
      shell.renderRoute(route.id);
    });
    root.replaceChildren(shell.element);
    shell.renderRoute(router.current());
  };

  const renderLogin = (message?: string): void => {
    stopRouting();
    renderLoginPage(root, {
      config,
      auth,
      onAuthenticated: () => {
        void auth.restore().then((user) => {
          if (user === null) {
            renderLogin();
          } else {
            renderShell(user);
          }
        });
      },
    });
    if (message !== undefined) {
      prependLoginMessage(root, message);
    }
  };

  router.start();

  try {
    const user = await auth.restore();
    // Registered after the first restore, because onAuthenticated reports the
    // current user to a new listener immediately and the outcome of the restore
    // is rendered below. Later `null` values are the logout of the profile menu.
    auth.onAuthenticated((current) => {
      if (current === null) {
        renderLogin();
      } else {
        renderShell(current);
      }
    });
    if (user === null) {
      renderLogin();
    } else {
      renderShell(user);
    }
  } catch (error) {
    renderLogin(messageOfError(error, t('app.sessionRestoreFailed')));
  }
}
