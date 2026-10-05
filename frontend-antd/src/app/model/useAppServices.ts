import { useMemo } from 'react';

import type { FileApi } from '@/entities/file';
import type { UserApi } from '@/entities/user';
import type { AuthProvider } from '@/features/auth';
import type { ThemeStore } from '@/features/theme-switch';
import type { FilesStore } from '@/pages/documents';
import type { UsersStore } from '@/pages/users';
import type { Router } from '@/shared/lib';

import { createFileApi, FILE_QUERYABLE_PROPERTIES } from '@/entities/file';
import { createUserApi, USER_QUERYABLE_PROPERTIES } from '@/entities/user';
import { createAuthProvider, SessionStore } from '@/features/auth';
import { createThemeStore } from '@/features/theme-switch';
import { FilesStore as FilesStoreImpl } from '@/pages/documents';
import { UsersStore as UsersStoreImpl } from '@/pages/users';
import { ODataClient } from '@/shared/api';
import { config as appConfig, type AppConfig } from '@/shared/config';
import { createRouter } from '@/shared/lib';

export interface AppServices {
  auth: AuthProvider;
  fileApi: FileApi;
  filesStore: FilesStore;
  router: Router;
  session: SessionStore;
  themeStore: ThemeStore;
  userApi: UserApi;
  usersStore: UsersStore;
}

/**
 * Creates the API clients, the stores, the router and the theme store of the
 * application. They only depend on the configuration, so the set is rebuilt
 * exactly when a different configuration object is passed, which `main.tsx`
 * avoids by not passing one.
 */
export function useAppServices(config: AppConfig = appConfig): AppServices {
  return useMemo<AppServices>(() => {
    const auth = createAuthProvider(config);
    const odata = new ODataClient({
      baseUrl: config.apiBaseUrl,
      queryableProperties: {
        Files: FILE_QUERYABLE_PROPERTIES,
        Users: USER_QUERYABLE_PROPERTIES,
      },
    });
    const fileApi = createFileApi({ baseUrl: config.apiBaseUrl, odata });
    const userApi = createUserApi({ baseUrl: config.apiBaseUrl, odata });

    return {
      auth,
      fileApi,
      filesStore: new FilesStoreImpl(fileApi),
      router: createRouter(),
      session: new SessionStore(auth),
      themeStore: createThemeStore(config.theme),
      userApi,
      usersStore: new UsersStoreImpl(userApi),
    };
  }, [config]);
}
