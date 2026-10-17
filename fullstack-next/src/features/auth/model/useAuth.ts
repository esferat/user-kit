'use client';

import { useContext, useSyncExternalStore } from 'react';
import type { AuthenticatedUser, Role } from '@/entities/user';

import { AuthContext } from './authContext';
import type { AuthSnapshot, SessionStore } from './sessionStore';

export interface AuthApi extends AuthSnapshot {
  login(role?: Role): Promise<void>;
  logout(): Promise<void>;
}

/**
 * Состояние сессии и команды входа/выхода. Подписка через
 * `useSyncExternalStore` перерисовывает компонент на каждое изменение стора,
 * поэтому возвращаемые поля всегда свежие.
 */
export function useAuth(): AuthApi {
  const store: SessionStore | null = useContext(AuthContext);
  if (store === null) {
    throw new Error('useAuth должен вызываться внутри AuthSessionProvider');
  }
  const snapshot = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getServerSnapshot);
  return { ...snapshot, login: store.login, logout: store.logout };
}

/** Текущий пользователь или `null`; удобно там, где нужны только данные. */
export function useCurrentUser(): AuthenticatedUser | null {
  return useAuth().user;
}
