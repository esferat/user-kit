import type { MeResponse, Role, UserDto } from '../model/types';

import type { ODataClient } from '@/shared/api';

import { joinUrl, requestJson, type ODataListResponse, type ODataQuery } from '@/shared/api';

export interface UserApi {
  /** The principal behind the current access token. */
  me(signal?: AbortSignal): Promise<MeResponse>;
  list(query: ODataQuery, signal?: AbortSignal): Promise<ODataListResponse<UserDto>>;
  updateRoles(id: string, roles: readonly Role[], etag?: string, signal?: AbortSignal): Promise<UserDto>;
}

export interface UserApiOptions {
  baseUrl: string;
  odata: ODataClient;
}

export function createUserApi(options: UserApiOptions): UserApi {
  const { baseUrl, odata } = options;

  return {
    me: (signal) => requestJson<MeResponse>(joinUrl(baseUrl, '/api/v1/me'), { signal }),
    list: (query, signal) => odata.list<UserDto>('Users', query, signal),
    updateRoles: (id, roles, etag, signal) => odata.update<UserDto>('Users', id, { roles }, etag, signal),
  };
}
