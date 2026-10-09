import type { MeResponse, Role, UserDto } from '../model/types';

import { joinUrl, requestJson, type PageResponse } from '@/shared/api';

/** Параметры списка: поиск по email, имени и логину, сортировка, страница. */
export interface UserListQuery {
  search?: string;
  /** Свойство с необязательным ведущим минусом для убывания, например `-email`. */
  sort?: string;
  page?: number;
  size?: number;
}

export interface UserApi {
  /** Принципал, стоящий за текущим access token. */
  me(signal?: AbortSignal): Promise<MeResponse>;
  list(query?: UserListQuery, signal?: AbortSignal): Promise<PageResponse<UserDto>>;
  updateRoles(id: string, roles: readonly Role[], etag?: string, signal?: AbortSignal): Promise<UserDto>;
}

export interface UserApiOptions {
  baseUrl: string;
}

function userListUrl(baseUrl: string, query: UserListQuery = {}): string {
  const url = joinUrl(baseUrl, '/api/v1/users');
  const params = new URLSearchParams();
  const search = query.search?.trim();
  if (search !== undefined && search !== '') {
    params.set('search', search);
  }
  if (query.sort !== undefined && query.sort !== '') {
    params.set('sort', query.sort);
  }
  if (query.page !== undefined) {
    params.set('page', String(query.page));
  }
  if (query.size !== undefined) {
    params.set('size', String(query.size));
  }
  const encoded = params.toString();
  return encoded === '' ? url : url + '?' + encoded;
}

export function createUserApi(options: UserApiOptions): UserApi {
  const { baseUrl } = options;

  return {
    me: (signal) => requestJson<MeResponse>(joinUrl(baseUrl, '/api/v1/me'), { signal }),
    list: (query, signal) => requestJson<PageResponse<UserDto>>(userListUrl(baseUrl, query), { signal }),
    updateRoles: (id, roles, etag, signal) =>
      requestJson<UserDto>(joinUrl(baseUrl, `/api/v1/users/${encodeURIComponent(id)}`), {
        method: 'PATCH',
        body: JSON.stringify({ roles }),
        signal,
        headers: etag === undefined ? {} : { 'If-Match': etag },
      }),
  };
}
