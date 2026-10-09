import { useMemo } from 'react';

import type { FileApi } from '@/entities/file';
import type { UserApi } from '@/entities/user';
import type { AuthProvider } from '@/features/auth';
import type { ThemeStore } from '@/features/theme-switch';
import type { FilesStore } from '@/pages/documents';
import type { UsersStore } from '@/pages/users';
import type { Router } from '@/shared/lib';

import { createFileApi } from '@/entities/file';
import { createUserApi } from '@/entities/user';
import { createAuthProvider, SessionStore } from '@/features/auth';
import { createThemeStore } from '@/features/theme-switch';
import { FilesStore as FilesStoreImpl } from '@/pages/documents';
import { UsersStore as UsersStoreImpl } from '@/pages/users';
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
 * Создаёт API-клиенты, сторы, роутер и стор темы приложения. Они зависят
 * только от конфигурации, поэтому набор пересоздаётся ровно тогда, когда
 * передан другой объект конфигурации, чего `main.tsx` избегает, не передавая
 * его.
 */
export function useAppServices(config: AppConfig = appConfig): AppServices {
  return useMemo<AppServices>(() => {
    const auth = createAuthProvider(config);
    const fileApi = createFileApi({ baseUrl: config.apiBaseUrl });
    const userApi = createUserApi({ baseUrl: config.apiBaseUrl });

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
