import { createContext, use, useEffect } from 'react';

import type { SessionStore } from '../model/sessionStore';

const SessionContext = createContext<SessionStore | null>(null);

export interface AuthSessionProviderProps {
  store: SessionStore;
  children: React.ReactNode;
}

/**
 * Makes the session store reachable and starts it once. The store holds the
 * state, so the components below only have to observe what they read.
 */
export function AuthSessionProvider({ store, children }: AuthSessionProviderProps) {
  useEffect(() => store.start(), [store]);

  return <SessionContext value={store}>{children}</SessionContext>;
}

/** Store of the current session; only valid below an `AuthSessionProvider`. */
export function useAuthSession(): SessionStore {
  const store = use(SessionContext);
  if (store === null) {
    throw new Error('useAuthSession must be used inside an AuthSessionProvider');
  }
  return store;
}
