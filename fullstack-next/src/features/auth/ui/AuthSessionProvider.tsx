'use client';

import { useEffect, type ReactNode } from 'react';

import { AuthContext } from '../model/authContext';
import type { SessionStore } from '../model/sessionStore';

export interface AuthSessionProviderProps {
  store: SessionStore;
  children: ReactNode;
}

/** Делает стор сессии доступным потомкам и запускает восстановление один раз. */
export function AuthSessionProvider({ store, children }: AuthSessionProviderProps) {
  useEffect(() => store.start(), [store]);
  return <AuthContext value={store}>{children}</AuthContext>;
}
