import { createContext, use, useCallback, useEffect, useMemo, useRef, useState } from 'react';

import type { AuthProvider } from '../model/types';

import type { AuthenticatedUser } from '@/entities/user';

export type AuthStatus = 'restoring' | 'anonymous' | 'authenticated';

export interface AuthSession {
  auth: AuthProvider;
  user: AuthenticatedUser | null;
  status: AuthStatus;
  /** Reason of a failed session restore, shown on the login screen. */
  error: unknown;
  login(returnUrl?: string): Promise<void>;
  logout(): Promise<void>;
}

const AuthSessionContext = createContext<AuthSession | null>(null);

export interface AuthSessionProviderProps {
  auth: AuthProvider;
  children: React.ReactNode;
}

/**
 * Turns the authentication facade into React state: it restores the session once
 * and follows every later change the provider reports, which is how the logout of
 * the profile menu brings the login screen back.
 */
export function AuthSessionProvider({ auth, children }: AuthSessionProviderProps) {
  const [state, setState] = useState<{ user: AuthenticatedUser | null; status: AuthStatus; error: unknown }>({
    user: null,
    status: 'restoring',
    error: undefined,
  });

  /**
   * `StrictMode` runs every effect twice, and a second `restore()` of an OIDC
   * redirect callback would consume the same `code` and `state` twice. The restore
   * therefore starts once per provider instance, and its result is applied through
   * `mounted` because the second effect run reuses the same component instance.
   */
  const mounted = useRef(false);
  const restoring = useRef<AuthProvider | null>(null);
  /** The provider reports its current user immediately, which is not the result yet. */
  const restored = useRef(false);

  useEffect(() => {
    mounted.current = true;

    return () => {
      mounted.current = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    restored.current = false;

    const unsubscribe = auth.onAuthenticated((user) => {
      if (!active || !restored.current) {
        return;
      }
      setState({ user, status: user === null ? 'anonymous' : 'authenticated', error: undefined });
    });

    if (restoring.current !== auth) {
      restoring.current = auth;
      void auth.restore().then(
        (user) => {
          restored.current = true;
          if (!mounted.current) {
            return;
          }
          setState({ user, status: user === null ? 'anonymous' : 'authenticated', error: undefined });
        },
        (error: unknown) => {
          restored.current = true;
          if (!mounted.current) {
            return;
          }
          setState({ user: null, status: 'anonymous', error });
        },
      );
    }

    return () => {
      active = false;
      unsubscribe();
    };
  }, [auth]);

  const login = useCallback(
    async (returnUrl?: string): Promise<void> => {
      await auth.login(returnUrl);
      // The dev provider authenticates in place, the OIDC provider leaves the page.
      const user = await auth.restore();
      setState({ user, status: user === null ? 'anonymous' : 'authenticated', error: undefined });
    },
    [auth],
  );

  const logout = useCallback(async (): Promise<void> => {
    try {
      await auth.logout();
    } catch (error) {
      // The provider already dropped its local session before it redirects, so a
      // failing redirect leaves nothing to recover: the session keeps whatever the
      // provider reported and the reason only deserves the console.
      console.error('logout failed', error);
    }
  }, [auth]);

  const session = useMemo<AuthSession>(
    () => ({ auth, user: state.user, status: state.status, error: state.error, login, logout }),
    [auth, state.user, state.status, state.error, login, logout],
  );

  return <AuthSessionContext value={session}>{children}</AuthSessionContext>;
}

/** Session of the current user; only valid below an `AuthSessionProvider`. */
export function useAuthSession(): AuthSession {
  const session = use(AuthSessionContext);
  if (session === null) {
    throw new Error('useAuthSession must be used inside an AuthSessionProvider');
  }
  return session;
}
