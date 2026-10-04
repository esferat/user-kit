import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AuthenticationError, type AuthProvider } from '../model/types';

import { DevAuthProvider } from './devAuthProvider';

const SESSION_KEY = 'user-kit:dev-session';

const NOW = 1_800_000_000;

function session(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    accessToken: 'dev-token',
    expiresAt: NOW + 60,
    subject: 'dev-1',
    email: 'dev@example.com',
    displayName: 'Dev User',
    roles: ['admin'],
    ...overrides,
  };
}

let provider: AuthProvider;

beforeEach(() => {
  vi.useFakeTimers({ now: NOW * 1000 });
  window.sessionStorage.clear();
  provider = new DevAuthProvider('', 'admin');
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('DevAuthProvider', () => {
  it('has no principal without a stored session', async () => {
    await expect(provider.restore()).resolves.toBeNull();
    await expect(provider.getAccessToken()).resolves.toBeNull();
  });

  it('stores the session of the dev token endpoint', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          new Response(JSON.stringify(session()), { status: 200, headers: { 'content-type': 'application/json' } }),
        ),
    );

    await provider.login();

    const [url] = (globalThis.fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0] as [string];
    expect(url).toBe('/api/v1/dev/token?role=admin');
    await expect(provider.restore()).resolves.toMatchObject({ email: 'dev@example.com', roles: ['admin'] });
    await expect(provider.getAccessToken()).resolves.toBe('dev-token');
  });

  it('reports an unavailable token endpoint', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 404 })));

    await expect(provider.login()).rejects.toBeInstanceOf(AuthenticationError);
  });

  it('drops an expired session', async () => {
    window.sessionStorage.setItem(SESSION_KEY, JSON.stringify(session({ expiresAt: NOW - 1 })));

    await expect(provider.restore()).resolves.toBeNull();
    expect(window.sessionStorage.getItem(SESSION_KEY)).toBeNull();
    await expect(provider.getAccessToken()).resolves.toBeNull();
  });

  it('drops a malformed session', async () => {
    window.sessionStorage.setItem(SESSION_KEY, 'not json');

    await expect(provider.restore()).resolves.toBeNull();
  });

  it('notifies the listeners and forgets the session on logout', async () => {
    const users: Array<string | null> = [];
    const unsubscribe = provider.onAuthenticated((user) => users.push(user?.email ?? null));

    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          new Response(JSON.stringify(session()), { status: 200, headers: { 'content-type': 'application/json' } }),
        ),
    );
    await provider.login();
    await provider.logout();
    unsubscribe();

    expect(users).toEqual([null, 'dev@example.com', null]);
    await expect(provider.getAccessToken()).resolves.toBeNull();
  });
});
