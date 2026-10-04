import { afterEach, describe, expect, it, vi } from 'vitest';

import { ApiError } from '../http';

import { ODataClient } from './odataClient';

function jsonResponse(body: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' },
    ...init,
  });
}

/** `application/x-www-form-urlencoded` uses `+` for spaces, `decodeURIComponent` does not. */
function decodeUrl(url: string): string {
  return decodeURIComponent(url.replaceAll('+', '%20'));
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('ODataClient', () => {
  const client = (): ODataClient =>
    new ODataClient({
      baseUrl: 'http://api:8080',
      getAccessToken: async () => 'token-1',
      queryableProperties: { Files: ['id', 'name', 'sizeBytes'] },
    });

  it('fails fast without a token', async () => {
    const anonymous = new ODataClient({ baseUrl: '', getAccessToken: async () => null });
    await expect(anonymous.list('Files')).rejects.toBeInstanceOf(ApiError);
  });

  it('lists entities with query options', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ '@odata.count': 1, value: [{ id: '1' }] }));
    vi.stubGlobal('fetch', fetchMock);

    const result = await client().list('Files', {
      filter: { kind: 'comparison', property: 'name', operator: 'eq', value: 'a.txt' },
      orderBy: [{ property: 'sizeBytes', descending: true }],
      top: 10,
      count: true,
    });

    const [url] = fetchMock.mock.calls[0] as unknown as [string];
    expect(url).toContain('http://api:8080/odata/Files?');
    expect(decodeUrl(url)).toContain("$filter=name eq 'a.txt'");
    expect(decodeUrl(url)).toContain('$orderby=sizeBytes desc');
    expect(decodeUrl(url)).toContain('$top=10');
    expect(result['@odata.count']).toBe(1);
    expect(result.value).toHaveLength(1);
  });

  it('rejects $filter on properties that are not queryable', async () => {
    vi.stubGlobal('fetch', vi.fn());
    await expect(
      client().list('Files', {
        filter: { kind: 'comparison', property: 'storageKey', operator: 'eq', value: 'x' },
      }),
    ).rejects.toBeInstanceOf(Error);
  });

  it('sends If-Match when an etag is provided', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({}));
    vi.stubGlobal('fetch', fetchMock);

    await client().update('Files', 'file-1', { name: 'new' }, 'W/"1"');

    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('http://api:8080/odata/Files/file-1');
    expect(init.method).toBe('PATCH');
    expect((init.headers as Record<string, string>)['If-Match']).toBe('W/"1"');
  });

  it('creates entities with a JSON body', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ id: 'f-1' }));
    vi.stubGlobal('fetch', fetchMock);

    await client().create('Files', { name: 'a.txt' });

    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('http://api:8080/odata/Files');
    expect(init.method).toBe('POST');
    expect(init.body).toBe(JSON.stringify({ name: 'a.txt' }));
  });

  it('deletes entities', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal('fetch', fetchMock);

    await client().remove('Files', 'file-1');

    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('http://api:8080/odata/Files/file-1');
    expect(init.method).toBe('DELETE');
  });

  it('encodes keys', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ id: 'a b' }));
    vi.stubGlobal('fetch', fetchMock);

    await client().get('Files', 'a b');

    const [url] = fetchMock.mock.calls[0] as unknown as [string];
    expect(url).toBe('http://api:8080/odata/Files/a%20b');
  });

  it('reads $metadata as XML', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response('<metadata/>', { status: 200, headers: { 'content-type': 'application/xml' } }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(client().metadata()).resolves.toBe('<metadata/>');
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('http://api:8080/odata/$metadata');
    expect((init.headers as Record<string, string>).Accept).toBe('application/xml');
  });
});
