import { fireEvent, render, screen } from '@testing-library/react';
import { StrictMode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

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

/** Authentication facade with the listener behaviour of the real providers. */
function createAuth(options: { restored?: AuthenticatedUser | null; restoreError?: unknown } = {}): AuthProvider {
  const listeners = new Set<(user: AuthenticatedUser | null) => void>();
  let current: AuthenticatedUser | null = null;

  return {
    mode: vi.fn(async (): Promise<AuthMode> => 'oidc'),
    restore: vi.fn(async () => {
      if (options.restoreError !== undefined) {
        throw options.restoreError;
      }
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

function Probe() {
  const { status, user, error, login, logout } = useAuthSession();
  return (
    <div>
      <span data-testid="status">{status}</span>
      <span data-testid="user">{user?.displayName ?? '-'}</span>
      <span data-testid="error">{error instanceof Error ? error.message : '-'}</span>
      <button type="button" onClick={() => void login('#/documents')}>
        sign in
      </button>
      <button type="button" onClick={() => void logout()}>
        sign out
      </button>
    </div>
  );
}

function renderSession(auth: AuthProvider) {
  return render(
    <AuthSessionProvider auth={auth}>
      <Probe />
    </AuthSessionProvider>,
  );
}

function status(): string | null {
  return screen.getByTestId('status').textContent;
}

beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
});

describe('AuthSessionProvider', () => {
  it('reports no user while the session is restored', () => {
    const auth = createAuth();
    auth.restore = vi.fn(() => new Promise<null>(() => undefined));

    renderSession(auth);

    expect(status()).toBe('restoring');
  });

  it('is anonymous without a stored session', async () => {
    renderSession(createAuth());

    await vi.waitFor(() => expect(status()).toBe('anonymous'));
    expect(screen.getByTestId('user').textContent).toBe('-');
  });

  it('authenticates the restored user', async () => {
    renderSession(createAuth({ restored: USER }));

    await vi.waitFor(() => expect(status()).toBe('authenticated'));
    expect(screen.getByTestId('user').textContent).toBe('Jane Doe');
  });

  it('keeps the reason of a failed restore', async () => {
    renderSession(createAuth({ restoreError: new Error('session expired') }));

    await vi.waitFor(() => expect(screen.getByTestId('error').textContent).toBe('session expired'));
    expect(status()).toBe('anonymous');
  });

  it('follows the logout of the provider', async () => {
    renderSession(createAuth({ restored: USER }));
    await vi.waitFor(() => expect(status()).toBe('authenticated'));

    fireEvent.click(screen.getByRole('button', { name: 'sign out' }));

    await vi.waitFor(() => expect(status()).toBe('anonymous'));
    expect(screen.getByTestId('user').textContent).toBe('-');
  });

  it('signs the user in with the current hash as return url', async () => {
    const auth = createAuth();
    renderSession(auth);
    await vi.waitFor(() => expect(status()).toBe('anonymous'));
    auth.restore = vi.fn(async () => USER);

    fireEvent.click(screen.getByRole('button', { name: 'sign in' }));

    await vi.waitFor(() => expect(status()).toBe('authenticated'));
    expect(auth.login).toHaveBeenCalledWith({ returnUrl: '#/documents' });
    expect(screen.getByTestId('user').textContent).toBe('Jane Doe');
  });

  it('restores the session once even when the effects run twice', async () => {
    const auth = createAuth({ restored: USER });

    render(
      <StrictMode>
        <AuthSessionProvider auth={auth}>
          <Probe />
        </AuthSessionProvider>
      </StrictMode>,
    );

    await vi.waitFor(() => expect(status()).toBe('authenticated'));
    expect(auth.restore).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('user').textContent).toBe('Jane Doe');
  });

  it('keeps the session when the logout of the provider fails', async () => {
    const auth = createAuth({ restored: USER });
    auth.logout = vi.fn(async () => {
      throw new Error('end session endpoint is unreachable');
    });
    renderSession(auth);
    await vi.waitFor(() => expect(status()).toBe('authenticated'));

    fireEvent.click(screen.getByRole('button', { name: 'sign out' }));

    await vi.waitFor(() => expect(console.error).toHaveBeenCalledOnce());
    expect(status()).toBe('authenticated');
    expect(screen.getByTestId('error').textContent).toBe('-');
  });

  it('fails outside of a provider', () => {
    expect(() => render(<Probe />)).toThrow('useAuthSession must be used inside an AuthSessionProvider');
  });
});
