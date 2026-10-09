import { afterEach, describe, expect, it, vi } from 'vitest';

import { createFileApi } from './fileApi';

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } });
}

function api(options: { baseUrl?: string } = {}) {
  const baseUrl = options.baseUrl ?? '';
  return createFileApi({ baseUrl });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('createFileApi', () => {
  it('lists the files as a page of the REST resource', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ items: [{ id: 'f-1' }], total: 1, page: 0, size: 50 }));
    vi.stubGlobal('fetch', fetchMock);

    const response = await api({ baseUrl: 'http://api:8080' }).list({ size: 50 });

    expect(response).toEqual({ items: [{ id: 'f-1' }], total: 1, page: 0, size: 50 });
    expect(fetchMock.mock.calls[0][0]).toBe('http://api:8080/api/v1/files?size=50');
  });

  it('passes search, sort and pagination as query parameters', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ items: [], total: 0, page: 0, size: 50 }));
    vi.stubGlobal('fetch', fetchMock);

    await api({ baseUrl: 'http://api:8080' }).list({ search: '  report  ', sort: '-createdAt', page: 1, size: 50 });

    const [url] = fetchMock.mock.calls[0] as unknown as [string];
    expect(url).toBe('http://api:8080/api/v1/files?search=report&sort=-createdAt&page=1&size=50');
  });

  it('sends multipart payloads for uploads', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ id: 'f-1' }));
    vi.stubGlobal('fetch', fetchMock);

    await api().upload(new File(['content'], 'note.txt', { type: 'text/plain' }), 'description');

    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('/api/v1/files');
    expect(init.method).toBe('POST');
    const form = init.body as FormData;
    expect(form.get('file')).toBeInstanceOf(File);
    expect(form.get('description')).toBe('description');
  });

  it('omits an empty description', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ id: 'f-1' }));
    vi.stubGlobal('fetch', fetchMock);

    await api().upload(new File(['x'], 'x.txt'), undefined);

    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect((init.body as FormData).get('description')).toBeNull();
  });

  it('downloads the content as a blob', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('binary', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    const blob = await api({ baseUrl: 'http://api:8080' }).downloadContent('f 1');

    await expect(blob.text()).resolves.toBe('binary');
    expect(fetchMock.mock.calls[0][0]).toBe('http://api:8080/api/v1/files/f%201/content');
  });

  it('deletes a file with its etag', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal('fetch', fetchMock);

    await api().remove('f-1', 'W/"1"');

    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('/api/v1/files/f-1');
    expect(init.method).toBe('DELETE');
    expect((init.headers as Record<string, string>)['If-Match']).toBe('W/"1"');
  });

  it('sends no Authorization header, the cookie of the browser authenticates', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('binary', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    await api().downloadContent('f-1');

    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect((init.headers as Record<string, string>).Authorization).toBeUndefined();
    expect(init.credentials).toBe('include');
  });
});
