import { useMemo } from 'react';

import type { FileApi } from '@/entities/file';
import type { UserApi } from '@/entities/user';
import type { AuthProvider } from '@/features/auth';
import type { Router } from '@/shared/lib';

import { createFileApi } from '@/entities/file';
import { createUserApi } from '@/entities/user';
import { createAuthProvider } from '@/features/auth';
import { config as appConfig, type AppConfig } from '@/shared/config';
import { createRouter } from '@/shared/lib';

export interface AppServices {
  auth: AuthProvider;
  fileApi: FileApi;
  router: Router;
  userApi: UserApi;
}

/**
 * Создаёт API-клиенты и роутер приложения. Они зависят только от
 * конфигурации, поэтому набор пересоздаётся ровно тогда, когда передан другой
 * объект конфигурации, чего `main.tsx` избегает, не передавая его.
 */
export function useAppServices(config: AppConfig = appConfig): AppServices {
  return useMemo<AppServices>(() => {
    const auth = createAuthProvider(config);
    const fileApi = createFileApi({ baseUrl: config.apiBaseUrl });
    const userApi = createUserApi({ baseUrl: config.apiBaseUrl });

    return {
      auth,
      fileApi,
      router: createRouter(),
      userApi,
    };
  }, [config]);
}
