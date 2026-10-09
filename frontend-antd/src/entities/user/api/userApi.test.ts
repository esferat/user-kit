import { afterEach, describe, expect, it, vi } from 'vitest';

import { createUserApi } from './userApi';

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } });
}

function api(options: { baseUrl?: string } = {}) {
  const baseUrl = options.baseUrl ?? '';
  return createUserApi({ baseUrl });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('createUserApi', () => {
  it('reads the current principal from /api/v1/me', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ id: 'u-1', roles: ['user'] }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(api({ baseUrl: 'http://api:8080' }).me()).resolves.toMatchObject({ id: 'u-1' });
    expect(fetchMock.mock.calls[0][0]).toBe('http://api:8080/api/v1/me');
  });

  it('lists the users as a page of the REST resource', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ items: [{ id: 'u-1' }], total: 1, page: 0, size: 100 }));
    vi.stubGlobal('fetch', fetchMock);

    const response = await api({ baseUrl: 'http://api:8080' }).list({ size: 100 });

    expect(response.items).toHaveLength(1);
    expect(fetchMock.mock.calls[0][0]).toBe('http://api:8080/api/v1/users?size=100');
  });

  it('sorts by email via the sort parameter', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ items: [], total: 0, page: 0, size: 100 }));
    vi.stubGlobal('fetch', fetchMock);

    await api().list({ sort: 'email', size: 100 });

    const [url] = fetchMock.mock.calls[0] as unknown as [string];
    expect(url).toContain('sort=email');
  });

  it('patches the roles of a user', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ id: 'u-1', roles: ['admin'] }));
    vi.stubGlobal('fetch', fetchMock);

    await api().updateRoles('u-1', ['admin']);

    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('/api/v1/users/u-1');
    expect(init.method).toBe('PATCH');
    expect(init.body).toBe(JSON.stringify({ roles: ['admin'] }));
  });

  it('reads the principal with the cookie of the browser', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ id: 'u-1', roles: ['user'] }));
    vi.stubGlobal('fetch', fetchMock);

    await api().me();

    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect((init.headers as Record<string, string>).Authorization).toBeUndefined();
    expect(init.credentials).toBe('include');
  });
});
