import { configureStore } from '@reduxjs/toolkit';

import type { AppServices } from './useAppServices';

import { sessionReducer } from '@/features/auth';
import { createInitialThemeState, themeReducer, toTheme } from '@/features/theme-switch';
import { documentsReducer } from '@/pages/documents';
import { usersReducer } from '@/pages/users';

export interface CreateAppStoreOptions {
  services: AppServices;
  /** Тема из конфигурации сборки; сохранённый выбор пользователя имеет приоритет. */
  theme: string;
}

/**
 * Создаёт store приложения: срезы сессии, страниц и темы плюс thunk с
 * сервисами в extra argument. Сервисы не зависят от состояния, поэтому один
 * набор живёт ровно до смены конфигурации.
 */
export function createAppStore({ services, theme }: CreateAppStoreOptions) {
  return configureStore({
    reducer: {
      session: sessionReducer,
      documents: documentsReducer,
      users: usersReducer,
      theme: themeReducer,
    },
    preloadedState: {
      theme: createInitialThemeState(toTheme(theme)),
    },
    middleware: (getDefault) => getDefault({ thunk: { extraArgument: { services } } }),
  });
}

export type AppStore = ReturnType<typeof createAppStore>;

export type RootState = ReturnType<AppStore['getState']>;

export type AppDispatch = AppStore['dispatch'];
