import { configureStore } from '@reduxjs/toolkit';
import { fireEvent, render, screen } from '@testing-library/react';
import { StrictMode } from 'react';
import { Provider, useDispatch, useSelector } from 'react-redux';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { login, logout, selectSession, sessionReducer } from '../model/sessionSlice';

import { AuthSessionProvider } from './AuthSession';

import type { AuthMode, AuthProvider } from '../model/types';

import type { AuthenticatedUser } from '@/entities/user';
import type { AppDispatch } from '@/shared/lib';

const USER: AuthenticatedUser = {
  subject: 'oidc-1',
  username: 'jane',
  displayName: 'Jane Doe',
  email: 'jane@user-kit.local',
  roles: ['admin'],
};

function createAuth(restored: AuthenticatedUser | null = null): AuthProvider {
  const subscribers = new Set<(user: AuthenticatedUser | null) => void>();
  let current: AuthenticatedUser | null = restored;

  return {
    mode: vi.fn(async (): Promise<AuthMode> => 'oidc'),
    restore: vi.fn(async () => current),
    login: vi.fn(async () => undefined),
    logout: vi.fn(async () => {
      current = null;
      subscribers.forEach((listener) => listener(null));
    }),
    onAuthenticated: vi.fn((listener) => {
      subscribers.add(listener);
      listener(current);
      return () => {
        subscribers.delete(listener);
      };
    }),
  };
}

function Probe() {
  const session = useSelector(selectSession);
  const dispatch = useDispatch<AppDispatch>();

  return (
    <div>
      <span data-testid="status">{session.status}</span>
      <span data-testid="user">{session.user?.displayName ?? '-'}</span>
      <button type="button" onClick={() => void dispatch(login({ returnUrl: '#/documents' }))}>
        sign in
      </button>
      <button type="button" onClick={() => void dispatch(logout())}>
        sign out
      </button>
    </div>
  );
}

function renderSession(auth: AuthProvider, strict = false) {
  const store = configureStore({
    reducer: { session: sessionReducer },
    middleware: (getDefault) => getDefault({ thunk: { extraArgument: { services: { auth } } } }),
  });
  const tree = (
    <Provider store={store}>
      <AuthSessionProvider services={{ auth }}>
        <Probe />
      </AuthSessionProvider>
    </Provider>
  );
  return { ...render(strict ? <StrictMode>{tree}</StrictMode> : tree), store };
}

function status(): string | null {
  return screen.getByTestId('status').textContent;
}

function user(): string | null {
  return screen.getByTestId('user').textContent;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('AuthSessionProvider', () => {
  it('restores the session and mirrors it in the store', async () => {
    renderSession(createAuth(USER));

    await vi.waitFor(() => expect(status()).toBe('authenticated'));
    expect(user()).toBe('Jane Doe');
  });

  it('ends anonymous for a provider without a session', async () => {
    renderSession(createAuth(null));

    await vi.waitFor(() => expect(status()).toBe('anonymous'));
    expect(user()).toBe('-');
  });

  it('applies the user the provider signals after the restore', async () => {
    let notify: ((user: AuthenticatedUser | null) => void) | undefined;
    const auth = createAuth(null);
    auth.onAuthenticated = vi.fn((listener) => {
      notify = listener;
      return () => undefined;
    });
    renderSession(auth);
    await vi.waitFor(() => expect(status()).toBe('anonymous'));

    notify?.(USER);

    await vi.waitFor(() => expect(status()).toBe('authenticated'));
    expect(user()).toBe('Jane Doe');
  });

  it('signs the user out when the provider announces it', async () => {
    const auth = createAuth(USER);
    renderSession(auth);
    await vi.waitFor(() => expect(status()).toBe('authenticated'));

    fireEvent.click(screen.getByText('sign out'));

    await vi.waitFor(() => expect(status()).toBe('anonymous'));
    expect(user()).toBe('-');
  });

  it('starts the session once even when the effects run twice', async () => {
    const auth = createAuth(USER);

    renderSession(auth, true);

    await vi.waitFor(() => expect(status()).toBe('authenticated'));
    expect(auth.restore).toHaveBeenCalledOnce();
    expect(auth.mode).toHaveBeenCalledOnce();
  });

  it('unsubscribes from the provider on unmount', async () => {
    const auth = createAuth(USER);
    const unsubscribe = vi.fn();
    auth.onAuthenticated = vi.fn(() => unsubscribe);
    const { unmount } = renderSession(auth);
    await vi.waitFor(() => expect(status()).toBe('authenticated'));

    unmount();

    expect(unsubscribe).toHaveBeenCalledOnce();
  });
});
