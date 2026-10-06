import { describe, expect, it, vi } from 'vitest';

import { SessionStore } from './sessionStore';

import type { AuthMode, AuthProvider } from './types';

import type { AuthenticatedUser } from '@/entities/user';

const USER: AuthenticatedUser = {
  subject: 'oidc-1',
  username: 'jane',
  displayName: 'Jane Doe',
  email: 'jane@user-kit.local',
  roles: ['admin'],
};

/** Фасад аутентификации со слушателями, как у настоящих провайдеров. */
function createAuth(
  options: { restored?: AuthenticatedUser | null; mode?: AuthMode; modeError?: unknown } = {},
): AuthProvider {
  const listeners = new Set<(user: AuthenticatedUser | null) => void>();
  let current: AuthenticatedUser | null = null;

  return {
    mode: vi.fn(async (): Promise<AuthMode> => {
      if (options.modeError !== undefined) {
        throw options.modeError;
      }
      return options.mode ?? 'oidc';
    }),
    restore: vi.fn(async () => {
      current = options.restored ?? null;
      return current;
    }),
    login: vi.fn(async () => undefined),
    logout: vi.fn(async () => {
      current = null;
      listeners.forEach((listener) => listener(null));
    }),
    onAuthenticated: (listener) => {
      listeners.add(listener);
      listener(current);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

describe('SessionStore', () => {
  it('restoring until the session has been read', () => {
    const auth = createAuth();
    auth.restore = vi.fn(() => new Promise<null>(() => undefined));
    const store = new SessionStore(auth);

    expect(store.status).toBe('restoring');
    store.start();
    expect(store.status).toBe('restoring');
  });

  it('is anonymous without a stored session', async () => {
    const store = new SessionStore(createAuth());

    store.start();

    await vi.waitFor(() => expect(store.status).toBe('anonymous'));
    expect(store.user).toBeNull();
  });

  it('authenticates the restored user', async () => {
    const store = new SessionStore(createAuth({ restored: USER }));

    store.start();

    await vi.waitFor(() => expect(store.status).toBe('authenticated'));
    expect(store.user?.displayName).toBe('Jane Doe');
  });

  it('keeps the reason of a failed restore', async () => {
    const auth = createAuth();
    auth.restore = vi.fn(async () => {
      throw new Error('session expired');
    });
    const store = new SessionStore(auth);

    store.start();

    await vi.waitFor(() => expect(store.error).toBeInstanceOf(Error));
    expect((store.error as Error).message).toBe('session expired');
    expect(store.status).toBe('anonymous');
  });

  it('reads the login methods the backend offers', async () => {
    const auth = createAuth({ mode: 'dev' });
    const store = new SessionStore(auth);

    store.start();

    await vi.waitFor(() => expect(store.loginMode).toBe('dev'));
    expect(auth.mode).toHaveBeenCalledOnce();
  });

  it('reports an unreachable backend for the login methods', async () => {
    const auth = createAuth({ modeError: new Error('gateway timeout') });
    const store = new SessionStore(auth);

    store.start();

    await vi.waitFor(() => expect(store.failure).toBe('gateway timeout'));
    expect(store.loginMode).toBeNull();
  });

  it('restores the session once even when it is started twice', async () => {
    const auth = createAuth({ restored: USER });
    const store = new SessionStore(auth);

    store.start();
    const stop = store.start();

    await vi.waitFor(() => expect(store.status).toBe('authenticated'));
    expect(auth.restore).toHaveBeenCalledOnce();
    stop();
  });

  it('does not read the session again after a restart', async () => {
    const auth = createAuth({ restored: USER });
    const store = new SessionStore(auth);
    const first = store.start();
    await vi.waitFor(() => expect(store.status).toBe('authenticated'));
    first();

    store.start();

    await vi.waitFor(() => expect(store.status).toBe('authenticated'));
    expect(auth.restore).toHaveBeenCalledOnce();
    expect(auth.mode).toHaveBeenCalledOnce();
  });

  it('ignores a reported user until the restore has settled', async () => {
    const auth = createAuth();
    let resolveRestore!: (user: AuthenticatedUser | null) => void;
    auth.restore = vi.fn(() => new Promise<AuthenticatedUser | null>((resolve) => (resolveRestore = resolve)));
    let report: ((user: AuthenticatedUser | null) => void) | undefined;
    auth.onAuthenticated = vi.fn((listener) => {
      report = listener;
      return () => undefined;
    });
    const store = new SessionStore(auth);
    store.start();

    report?.(USER);

    expect(store.status).toBe('restoring');
    expect(store.user).toBeNull();

    resolveRestore(null);

    await vi.waitFor(() => expect(store.status).toBe('anonymous'));
  });

  it('follows the logout of the provider', async () => {
    const auth = createAuth({ restored: USER });
    const store = new SessionStore(auth);
    store.start();
    await vi.waitFor(() => expect(store.status).toBe('authenticated'));

    await store.logout();

    expect(store.status).toBe('anonymous');
    expect(store.user).toBeNull();
  });

  it('keeps the session when the logout of the provider fails', async () => {
    const auth = createAuth({ restored: USER });
    auth.logout = vi.fn(async () => {
      throw new Error('end session endpoint is unreachable');
    });
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const store = new SessionStore(auth);
    store.start();
    await vi.waitFor(() => expect(store.status).toBe('authenticated'));

    await store.logout();

    expect(store.status).toBe('authenticated');
    expect(consoleError).toHaveBeenCalledOnce();
    consoleError.mockRestore();
  });

  it('follows the user a dev login reports', async () => {
    const auth = createAuth();
    const store = new SessionStore(auth);
    store.start();
    await vi.waitFor(() => expect(store.status).toBe('anonymous'));

    await store.login('#/documents', 'admin');

    expect(auth.login).toHaveBeenCalledWith({ returnUrl: '#/documents', role: 'admin' });
    expect(auth.restore).toHaveBeenCalledTimes(2);
    expect(store.pending).toBe(false);
  });

  it('reports a failed login and stops waiting for it', async () => {
    const auth = createAuth();
    auth.login = vi.fn(async () => {
      throw new Error('login is not enabled');
    });
    const store = new SessionStore(auth);

    await store.login('#/documents');

    expect(store.failure).toBe('login is not enabled');
    expect(store.pending).toBe(false);
    expect(store.status).toBe('restoring');
  });
});
