import { configureStore } from '@reduxjs/toolkit';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  loadLoginMode,
  login,
  logout,
  restoreSession,
  selectSession,
  sessionReducer,
  userNotified,
} from './sessionSlice';

import type { AuthMode, AuthProvider, LoginOptions } from './types';

import type { AuthenticatedUser } from '@/entities/user';

import { i18n } from '@/shared/i18n';

const USER: AuthenticatedUser = {
  subject: 'oidc-1',
  username: 'jane',
  displayName: 'Jane Doe',
  email: 'jane@user-kit.local',
  roles: ['admin'],
};

function createAuth(restored: AuthenticatedUser | null = null): AuthProvider {
  let current: AuthenticatedUser | null = restored;
  return {
    mode: vi.fn(async (): Promise<AuthMode> => 'oidc'),
    restore: vi.fn(async () => current),
    login: vi.fn(async () => undefined),
    logout: vi.fn(async () => {
      current = null;
    }),
    onAuthenticated: () => () => undefined,
  };
}

function createStore(auth: AuthProvider) {
  return configureStore({
    reducer: { session: sessionReducer },
    middleware: (getDefault) => getDefault({ thunk: { extraArgument: { services: { auth } } } }),
  });
}

beforeEach(() => {
  i18n.setLocale('ru');
});

describe('sessionSlice', () => {
  it('restores the session of the provider', async () => {
    const auth = createAuth(USER);
    const store = createStore(auth);

    await store.dispatch(restoreSession());

    const state = selectSession(store.getState());
    expect(auth.restore).toHaveBeenCalledOnce();
    expect(state.user?.displayName).toBe('Jane Doe');
    expect(state.status).toBe('authenticated');
    expect(state.restored).toBe(true);
  });

  it('skips a repeated restore of an already started session', async () => {
    const auth = createAuth(USER);
    const store = createStore(auth);

    await store.dispatch(restoreSession());
    await store.dispatch(restoreSession());

    expect(auth.restore).toHaveBeenCalledOnce();
  });

  it('ends anonymous for a provider without a session', async () => {
    const store = createStore(createAuth(null));

    await store.dispatch(restoreSession());

    const state = selectSession(store.getState());
    expect(state.user).toBeNull();
    expect(state.status).toBe('anonymous');
  });

  it('ignores the provider notification before the restore is done', async () => {
    const auth = createAuth(null);
    const store = createStore(auth);

    store.dispatch(userNotified(USER));
    expect(selectSession(store.getState()).user).toBeNull();

    await store.dispatch(restoreSession());
    expect(selectSession(store.getState()).user).toBeNull();
  });

  it('applies the user that the provider signalled after the restore', async () => {
    const store = createStore(createAuth(null));

    await store.dispatch(restoreSession());
    await store.dispatch(userNotified(USER));

    const state = selectSession(store.getState());
    expect(state.user?.displayName).toBe('Jane Doe');
    expect(state.status).toBe('authenticated');
  });

  it('reports a failed restore for the login screen', async () => {
    const auth = createAuth(null);
    auth.restore = vi.fn(async () => {
      throw new Error('session expired');
    });
    const store = createStore(auth);

    await store.dispatch(restoreSession());

    const state = selectSession(store.getState());
    expect(state.status).toBe('anonymous');
    expect(state.restored).toBe(true);
    expect((state.error as Error).message).toBe('session expired');
  });

  it('loads the login methods of the provider', async () => {
    const auth = createAuth(null);
    const store = createStore(auth);

    await store.dispatch(loadLoginMode());

    expect(auth.mode).toHaveBeenCalledOnce();
    expect(selectSession(store.getState()).loginMode).toBe('oidc');
    expect(selectSession(store.getState()).modeLoading).toBe(false);
  });

  it('reports a failed request of the login methods', async () => {
    const auth = createAuth(null);
    auth.mode = vi.fn(async () => {
      throw new Error('backend is down');
    });
    const store = createStore(auth);

    await store.dispatch(loadLoginMode());

    expect(selectSession(store.getState()).failure).toBe('backend is down');
  });

  it('signs in with the return url and role and applies the restored user', async () => {
    const auth = createAuth(USER);
    const store = createStore(auth);

    await store.dispatch(login({ returnUrl: '#/documents', role: 'user' }));

    expect(auth.login).toHaveBeenCalledWith({ returnUrl: '#/documents', role: 'user' } satisfies LoginOptions);
    const state = selectSession(store.getState());
    expect(state.user?.displayName).toBe('Jane Doe');
    expect(state.pending).toBe(false);
  });

  it('reports a rejected sign in and keeps the session anonymous', async () => {
    const auth = createAuth(null);
    auth.login = vi.fn(async () => {
      throw new Error('authorization server unreachable');
    });
    const store = createStore(auth);

    await store.dispatch(login({}));

    const state = selectSession(store.getState());
    expect(state.failure).toBe('authorization server unreachable');
    expect(state.user).toBeNull();
    expect(state.pending).toBe(false);
  });

  it('signs the user out through the provider', async () => {
    const auth = createAuth(USER);
    const store = createStore(auth);

    await store.dispatch(restoreSession());
    await store.dispatch(logout());

    expect(auth.logout).toHaveBeenCalledOnce();
    expect(selectSession(store.getState()).user?.displayName).toBe('Jane Doe');
  });
});
