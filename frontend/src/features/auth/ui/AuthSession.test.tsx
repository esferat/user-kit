import { render, screen } from '@testing-library/react';
import { observer } from 'mobx-react-lite';
import { StrictMode } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { SessionStore } from '../model/sessionStore';

import { AuthSessionProvider, useAuthSession } from './AuthSession';

import type { AuthMode, AuthProvider } from '../model/types';

import type { AuthenticatedUser } from '@/entities/user';

const USER: AuthenticatedUser = {
  subject: 'oidc-1',
  username: 'jane',
  displayName: 'Jane Doe',
  email: 'jane@user-kit.local',
  roles: ['admin'],
};

function createAuth(restored: AuthenticatedUser | null = null): AuthProvider {
  const listeners = new Set<(user: AuthenticatedUser | null) => void>();
  let current: AuthenticatedUser | null = null;

  return {
    mode: vi.fn(async (): Promise<AuthMode> => 'oidc'),
    restore: vi.fn(async () => {
      current = restored;
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

const Probe = observer(function Probe() {
  const { status, user, login, logout } = useAuthSession();
  return (
    <div>
      <span data-testid="status">{status}</span>
      <span data-testid="user">{user?.displayName ?? '-'}</span>
      <button type="button" onClick={() => void login('#/documents')}>
        sign in
      </button>
      <button type="button" onClick={() => void logout()}>
        sign out
      </button>
    </div>
  );
});

function renderSession(store: SessionStore, strict = false) {
  const tree = (
    <AuthSessionProvider store={store}>
      <Probe />
    </AuthSessionProvider>
  );
  return render(strict ? <StrictMode>{tree}</StrictMode> : tree);
}

function status(): string | null {
  return screen.getByTestId('status').textContent;
}

describe('AuthSessionProvider', () => {
  it('renders the state the store observes', async () => {
    renderSession(new SessionStore(createAuth(USER)));

    await vi.waitFor(() => expect(status()).toBe('authenticated'));
    expect(screen.getByTestId('user').textContent).toBe('Jane Doe');
  });

  it('re-renders when the store changes', async () => {
    const store = new SessionStore(createAuth(USER));
    renderSession(store);
    await vi.waitFor(() => expect(status()).toBe('authenticated'));

    await store.logout();

    await vi.waitFor(() => expect(status()).toBe('anonymous'));
    expect(screen.getByTestId('user').textContent).toBe('-');
  });

  it('starts the store once even when the effects run twice', async () => {
    const auth = createAuth(USER);
    const start = vi.spyOn(SessionStore.prototype, 'start');

    renderSession(new SessionStore(auth), true);

    await vi.waitFor(() => expect(status()).toBe('authenticated'));
    expect(start).toHaveBeenCalledTimes(2);
    expect(auth.restore).toHaveBeenCalledOnce();
    start.mockRestore();
  });

  it('unsubscribes from the provider on unmount', async () => {
    const auth = createAuth(USER);
    const unsubscribe = vi.fn();
    auth.onAuthenticated = vi.fn(() => unsubscribe);
    const { unmount } = renderSession(new SessionStore(auth));
    await vi.waitFor(() => expect(status()).toBe('authenticated'));

    unmount();

    expect(unsubscribe).toHaveBeenCalledOnce();
  });

  it('fails outside of a provider', () => {
    expect(() => render(<Probe />)).toThrow('useAuthSession must be used inside an AuthSessionProvider');
  });
});
