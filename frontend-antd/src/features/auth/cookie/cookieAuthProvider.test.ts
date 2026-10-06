import { afterEach, describe, expect, it, vi } from 'vitest';

import { CookieAuthProvider } from './cookieAuthProvider';

function jsonResponse(body: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' },
    ...init,
  });
}

function setCookies(value: string): void {
  Object.defineProperty(document, 'cookie', { value, configurable: true, writable: true });
}

/** happy-dom сохраняет реальный location, поэтому наблюдается только assign(). */
function stubLocation(): { assigned: string[] } {
  const assigned: string[] = [];
  Object.defineProperty(window, 'location', {
    configurable: true,
    value: {
      hash: '#/documents',
      assign: (url: string) => assigned.push(url),
    },
  });
  return { assigned };
}

afterEach(() => {
  vi.unstubAllGlobals();
  setCookies('');
});

describe('CookieAuthProvider', () => {
  it('asks the backend which login it offers and caches the answer', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ mode: 'oidc', devEnabled: true, oidcConfigured: true }));
    vi.stubGlobal('fetch', fetchMock);
    const provider = new CookieAuthProvider('', 'user');

    await expect(provider.mode()).resolves.toBe('oidc');
    await expect(provider.mode()).resolves.toBe('oidc');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('restores the session from /api/v1/me without touching a token', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({
        id: 'u-1',
        subject: 'sub-1',
        email: 'anna@user-kit.local',
        displayName: 'Анна',
        roles: ['admin'],
        enabled: true,
      }),
    );
    vi.stubGlobal('fetch', fetchMock);
    const provider = new CookieAuthProvider('', 'user');

    await expect(provider.restore()).resolves.toEqual({
      subject: 'sub-1',
      username: 'anna@user-kit.local',
      displayName: 'Анна',
      email: 'anna@user-kit.local',
      roles: ['admin'],
    });

    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('/api/v1/me');
    expect((init.headers as Record<string, string>).Authorization).toBeUndefined();
    expect(init.credentials).toBe('include');
  });

  it('reports no session on 401 without an error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ code: 'unauthorized' }, { status: 401 })));
    const provider = new CookieAuthProvider('', 'user');

    await expect(provider.restore()).resolves.toBeNull();
  });

  it('passes other failures on to the shell', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('boom', { status: 500 })));
    const provider = new CookieAuthProvider('', 'user');

    await expect(provider.restore()).rejects.toMatchObject({ status: 500 });
  });

  it('redirects the browser to the backend for a provider login', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(jsonResponse({ mode: 'oidc', devEnabled: false, oidcConfigured: true })),
    );
    const { assigned } = stubLocation();
    const provider = new CookieAuthProvider('http://api:8080', 'user');

    await provider.login({ returnUrl: '#/admin-users' });

    expect(assigned).toEqual(['http://api:8080/api/v1/auth/login?returnUrl=%23%2Fadmin-users']);
  });

  it('signs in locally in dev mode and reports the principal', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ mode: 'dev', devEnabled: true, oidcConfigured: false }))
      .mockResolvedValueOnce(
        jsonResponse({
          subject: 'dev-1',
          displayName: 'Dev User',
          email: 'dev-1@dev.local',
          roles: ['admin'],
          expiresAt: 42,
        }),
      );
    vi.stubGlobal('fetch', fetchMock);
    setCookies('XSRF-TOKEN=csrf-1');
    const provider = new CookieAuthProvider('', 'user');
    const seen: unknown[] = [];
    provider.onAuthenticated((user) => seen.push(user));

    await provider.login({ role: 'admin' });

    const [url, init] = fetchMock.mock.calls[1] as unknown as [string, RequestInit];
    expect(url).toBe('/api/v1/auth/dev-login');
    expect(init.method).toBe('POST');
    expect(init.body).toBe(JSON.stringify({ role: 'admin' }));
    expect((init.headers as Record<string, string>)['X-XSRF-TOKEN']).toBe('csrf-1');
    expect(seen).toEqual([
      null,
      {
        subject: 'dev-1',
        username: 'dev-1@dev.local',
        displayName: 'Dev User',
        email: 'dev-1@dev.local',
        roles: ['admin'],
      },
    ]);
  });

  it('refuses to log in when the backend has no login method', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(jsonResponse({ mode: 'none', devEnabled: false, oidcConfigured: false })),
    );
    const provider = new CookieAuthProvider('', 'user');

    await expect(provider.login()).rejects.toThrow(/no login method/i);
  });

  it('drops the session on the backend and follows the provider logout URL', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ redirectUrl: 'https://idp/logout' }));
    vi.stubGlobal('fetch', fetchMock);
    setCookies('XSRF-TOKEN=csrf-1');
    const { assigned } = stubLocation();
    const provider = new CookieAuthProvider('', 'user');
    const seen: unknown[] = [];
    provider.onAuthenticated((user) => seen.push(user));

    await provider.logout();

    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('/api/v1/auth/logout');
    expect(init.method).toBe('POST');
    expect((init.headers as Record<string, string>)['X-XSRF-TOKEN']).toBe('csrf-1');
    // Слушатель вызывается один раз при подписке и один раз при выходе.
    expect(seen).toEqual([null, null]);
    expect(assigned).toEqual(['https://idp/logout']);
  });

  it('stays on the page when there is no provider session to end', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ redirectUrl: null })));
    const { assigned } = stubLocation();

    await new CookieAuthProvider('', 'user').logout();

    expect(assigned).toEqual([]);
  });
});
