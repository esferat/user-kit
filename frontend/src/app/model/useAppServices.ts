import { useMemo } from 'react';

import type { FileApi } from '@/entities/file';
import type { UserApi } from '@/entities/user';
import type { AuthProvider } from '@/features/auth';
import type { ThemeStore } from '@/features/theme-switch';
import type { Router } from '@/shared/lib';

import { createFileApi, FILE_QUERYABLE_PROPERTIES } from '@/entities/file';
import { createUserApi, USER_QUERYABLE_PROPERTIES } from '@/entities/user';
import { createAuthProvider } from '@/features/auth';
import { createThemeStore } from '@/features/theme-switch';
import { ODataClient } from '@/shared/api';
import { config as appConfig, type AppConfig } from '@/shared/config';
import { createRouter } from '@/shared/lib';

export interface AppServices {
  auth: AuthProvider;
  fileApi: FileApi;
  userApi: UserApi;
  router: Router;
  themeStore: ThemeStore;
}

/**
 * Creates the API clients, the router and the theme store of the application. They
 * only depend on the configuration, so the set is rebuilt exactly when a different
 * configuration object is passed, which `main.tsx` avoids by not passing one.
 */
export function useAppServices(config: AppConfig = appConfig): AppServices {
  return useMemo<AppServices>(() => {
    const auth = createAuthProvider(config);
    const odata = new ODataClient({
      baseUrl: config.apiBaseUrl,
      getAccessToken: () => auth.getAccessToken(),
      queryableProperties: {
        Files: FILE_QUERYABLE_PROPERTIES,
        Users: USER_QUERYABLE_PROPERTIES,
      },
    });

    return {
      auth,
      fileApi: createFileApi({ baseUrl: config.apiBaseUrl, odata, getAccessToken: () => auth.getAccessToken() }),
      userApi: createUserApi({ baseUrl: config.apiBaseUrl, odata, getAccessToken: () => auth.getAccessToken() }),
      router: createRouter(),
      themeStore: createThemeStore(config.theme),
    };
  }, [config]);
}
