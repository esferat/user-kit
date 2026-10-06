import { createContext, use, useEffect } from 'react';

import type { SessionStore } from '../model/sessionStore';

const SessionContext = createContext<SessionStore | null>(null);

export interface AuthSessionProviderProps {
  store: SessionStore;
  children: React.ReactNode;
}

/**
 * Делает session store доступным и запускает его один раз. Store хранит
 * состояние, поэтому компонентам ниже достаточно наблюдать за тем, что они читают.
 */
export function AuthSessionProvider({ store, children }: AuthSessionProviderProps) {
  useEffect(() => store.start(), [store]);

  return <SessionContext value={store}>{children}</SessionContext>;
}

/** Store текущей сессии; действует только внутри `AuthSessionProvider`. */
export function useAuthSession(): SessionStore {
  const store = use(SessionContext);
  if (store === null) {
    throw new Error('useAuthSession must be used inside an AuthSessionProvider');
  }
  return store;
}
