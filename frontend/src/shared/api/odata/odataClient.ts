import { request, requestJson } from '../http';

import { buildEntitySetUrl, joinUrl, type ODataQuery } from './query';

export interface ODataListResponse<T> {
  '@odata.context'?: string;
  '@odata.count'?: number;
  value: T[];
}

/** Optional OData control information attached to a payload. */
export type ODataEntity = {
  '@odata.id'?: string;
  '@odata.etag'?: string;
};

export interface ODataClientOptions {
  baseUrl: string;
  /** Property names that may be used in $filter/$orderby/$select per entity set. */
  queryableProperties?: Record<string, readonly string[]>;
}

/**
 * Thin OData V4 client: no library, only the subset of the protocol this
 * application relies on ($filter, $select, $orderby, $top, $skip, $count, $metadata).
 *
 * The client is protocol only and knows no entity; the entity slices build their
 * own API on top of it. Authorization is left to the browser: the backend expects
 * the httpOnly cookie of the login and sends the CSRF header along with writes.
 */
export class ODataClient {
  private readonly baseUrl: string;
  private readonly queryableProperties: Record<string, readonly string[]>;

  constructor(options: ODataClientOptions) {
    this.baseUrl = options.baseUrl;
    this.queryableProperties = options.queryableProperties ?? {};
  }

  private allowedProperties(entitySet: string): readonly string[] | undefined {
    return this.queryableProperties[entitySet];
  }

  async metadata(signal?: AbortSignal): Promise<string> {
    const response = await request(joinUrl(this.baseUrl, '/odata/$metadata'), {
      accept: 'application/xml',
      signal,
    });
    return response.text();
  }

  async list<T>(entitySet: string, query: ODataQuery = {}, signal?: AbortSignal): Promise<ODataListResponse<T>> {
    const url = buildEntitySetUrl(this.baseUrl, entitySet, query, this.allowedProperties(entitySet));
    return requestJson<ODataListResponse<T>>(url, { signal });
  }

  async get<T>(entitySet: string, key: string, signal?: AbortSignal): Promise<T> {
    const url = joinUrl(this.baseUrl, `/odata/${entitySet}/${encodeURIComponent(key)}`);
    return requestJson<T>(url, { signal });
  }

  async create<T>(entitySet: string, payload: unknown, signal?: AbortSignal): Promise<T> {
    const url = joinUrl(this.baseUrl, `/odata/${entitySet}`);
    return requestJson<T>(url, { method: 'POST', body: JSON.stringify(payload), signal });
  }

  async update<T>(entitySet: string, key: string, payload: unknown, etag?: string, signal?: AbortSignal): Promise<T> {
    const url = joinUrl(this.baseUrl, `/odata/${entitySet}/${encodeURIComponent(key)}`);
    return requestJson<T>(url, {
      method: 'PATCH',
      body: JSON.stringify(payload),
      signal,
      headers: etag === undefined ? {} : { 'If-Match': etag },
    });
  }

  async remove(entitySet: string, key: string, etag?: string, signal?: AbortSignal): Promise<void> {
    const url = joinUrl(this.baseUrl, `/odata/${entitySet}/${encodeURIComponent(key)}`);
    await request(url, {
      method: 'DELETE',
      signal,
      headers: etag === undefined ? {} : { 'If-Match': etag },
    });
  }
}
