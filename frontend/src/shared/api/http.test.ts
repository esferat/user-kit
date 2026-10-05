import { afterEach, describe, expect, it, vi } from 'vitest';

import { ApiError, csrfHeaders, readCookie, request, requestJson } from './http';

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

afterEach(() => {
  vi.unstubAllGlobals();
  setCookies('');
});

describe('request', () => {
  it('relies on the cookie of the browser instead of an Authorization header', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ ok: true }));
    vi.stubGlobal('fetch', fetchMock);

    await requestJson<{ ok: boolean }>('/api/v1/me');

    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('/api/v1/me');
    const headers = init.headers as Record<string, string>;
    expect(headers.Authorization).toBeUndefined();
    expect(headers.Accept).toBe('application/json');
    expect(init.credentials).toBe('include');
  });

  it('sets the JSON content type only when a body is present', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({}));
    vi.stubGlobal('fetch', fetchMock);

    await request('/api/v1/files', { method: 'POST', body: JSON.stringify({ a: 1 }) });

    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    const headers = init.headers as Record<string, string>;
    expect(headers['Content-Type']).toBe('application/json');
  });

  it('keeps multipart bodies untouched', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({}));
    vi.stubGlobal('fetch', fetchMock);
    const form = new FormData();

    await request('/api/v1/files', { method: 'POST', body: form, rawBody: true });

    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    const headers = init.headers as Record<string, string>;
    expect(headers['Content-Type']).toBeUndefined();
    expect(init.body).toBe(form);
  });

  it('repeats the CSRF cookie in the header of writes', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({}));
    vi.stubGlobal('fetch', fetchMock);
    setCookies('XSRF-TOKEN=token-42');

    await request('/api/v1/auth/logout', { method: 'POST', body: '{}' });

    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect((init.headers as Record<string, string>)['X-XSRF-TOKEN']).toBe('token-42');
  });

  it('does not send the CSRF header on reads', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({}));
    vi.stubGlobal('fetch', fetchMock);
    setCookies('XSRF-TOKEN=token-42');

    await request('/api/v1/me');

    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect((init.headers as Record<string, string>)['X-XSRF-TOKEN']).toBeUndefined();
  });

  it('returns undefined for 204 responses', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 204 })));
    await expect(requestJson('/odata/Files/1', { method: 'DELETE' })).resolves.toBeUndefined();
  });

  it('throws ApiError with the server message', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(jsonResponse({ code: 'forbidden', message: 'Not allowed' }, { status: 403 })),
    );

    await expect(request('/api/v1/admin/users')).rejects.toMatchObject({
      name: 'ApiError',
      status: 403,
      message: 'Not allowed',
      code: 'forbidden',
    });
  });

  it('reports unauthorized responses', () => {
    expect(new ApiError(401, 'nope').isUnauthorized).toBe(true);
    expect(new ApiError(404, 'nope').isUnauthorized).toBe(false);
  });

  it('falls back to a generic message for non JSON errors', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response('boom', { status: 500, headers: { 'content-type': 'text/plain' } })),
    );

    const error = (await request('/api/v1/me').catch((caught: unknown) => caught)) as ApiError;
    expect(error).toBeInstanceOf(ApiError);
    expect(error.status).toBe(500);
    expect(error.message).toContain('500');
  });
});

describe('cookies', () => {
  it('reads a single cookie', () => {
    setCookies('a=1; XSRF-TOKEN=token-42; b=2');
    expect(readCookie('XSRF-TOKEN')).toBe('token-42');
    expect(readCookie('missing')).toBeNull();
  });

  it('omits the CSRF header when the cookie is missing', () => {
    setCookies('');
    expect(csrfHeaders('POST')).toEqual({});
    expect(csrfHeaders('GET')).toEqual({});
  });
});
