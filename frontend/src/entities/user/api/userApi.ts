import type { MeResponse, Role, UserDto } from '../model/types';

import type { ODataClient } from '@/shared/api';

import { ApiError, joinUrl, requestJson, type ODataListResponse, type ODataQuery } from '@/shared/api';

export interface UserApi {
  /** The principal behind the current access token. */
  me(signal?: AbortSignal): Promise<MeResponse>;
  list(query: ODataQuery, signal?: AbortSignal): Promise<ODataListResponse<UserDto>>;
  updateRoles(id: string, roles: readonly Role[], etag?: string, signal?: AbortSignal): Promise<UserDto>;
}

export interface UserApiOptions {
  baseUrl: string;
  odata: ODataClient;
  getAccessToken: () => Promise<string | null>;
}

export function createUserApi(options: UserApiOptions): UserApi {
  const { baseUrl, odata } = options;

  async function requireToken(): Promise<string> {
    const token = await options.getAccessToken();
    if (!token) {
      throw new ApiError(401, 'No access token available');
    }
    return token;
  }

  return {
    me: async (signal) =>
      requestJson<MeResponse>(joinUrl(baseUrl, '/api/v1/me'), { token: await requireToken(), signal }),
    list: (query, signal) => odata.list<UserDto>('Users', query, signal),
    updateRoles: (id, roles, etag, signal) => odata.update<UserDto>('Users', id, { roles }, etag, signal),
  };
}
