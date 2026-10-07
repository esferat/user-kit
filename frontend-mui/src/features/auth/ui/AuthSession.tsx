import { useEffect, type ReactNode } from 'react';
import { useDispatch } from 'react-redux';

import { loadLoginMode, restoreSession, userNotified } from '../model/sessionSlice';

import type { AuthProvider } from '../model/types';

import type { AppDispatch } from '@/shared/lib';

export interface AuthSessionProviderProps {
  services: { auth: AuthProvider };
  children: ReactNode;
}

/**
 * Живёт один раз на приложение: восстанавливает сессию, читает доступные
 * методы входа и подписывается на уведомления провайдера (dev-вход, выход).
 * Само состояние хранится в срезе сессии, которого достаточно для отрисовки.
 */
export function AuthSessionProvider({ services, children }: AuthSessionProviderProps) {
  const dispatch = useDispatch<AppDispatch>();

  useEffect(() => {
    dispatch(restoreSession());
    dispatch(loadLoginMode());
  }, [dispatch, services]);

  useEffect(() => services.auth.onAuthenticated((user) => dispatch(userNotified(user))), [dispatch, services]);

  return children;
}
