'use client';

import { useEffect, type ReactNode } from 'react';
import { type SessionStore, AuthContext } from '@/features/auth';

export interface AuthSessionProviderProps {
  store: SessionStore;
  children: ReactNode;
}

/** Делает стор сессии доступным потомкам и запускает восстановление один раз. */
export function AuthSessionProvider({ store, children }: AuthSessionProviderProps) {
  useEffect(() => store.start(), [store]);
  return <AuthContext value={store}>{children}</AuthContext>;
}
