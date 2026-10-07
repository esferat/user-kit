import { request, requestJson } from '../http';

import { buildEntitySetUrl, joinUrl, type ODataQuery } from './query';

export interface ODataListResponse<T> {
  '@odata.context'?: string;
  '@odata.count'?: number;
  value: T[];
}

/** Необязательная служебная информация OData, прилагаемая к полезной нагрузке. */
export type ODataEntity = {
  '@odata.id'?: string;
  '@odata.etag'?: string;
};

export interface ODataClientOptions {
  baseUrl: string;
  /** Имена свойств, которые можно использовать в $filter/$orderby/$select для каждого набора сущностей. */
  queryableProperties?: Record<string, readonly string[]>;
}

/**
 * Тонкий клиент OData V4: без библиотек, только та часть протокола, на которую
 * опирается это приложение ($filter, $select, $orderby, $top, $skip, $count, $metadata).
 *
 * Клиент реализует только протокол и ничего не знает о сущностях; slices сущностей
 * строят поверх него собственный API. Авторизацию ведёт браузер: бэкенд ожидает
 * httpOnly cookie входа и отправляет CSRF-заголовок вместе с операциями записи.
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
