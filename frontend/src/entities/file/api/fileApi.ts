import type { FileObjectDto } from '../model/types';

import type { ODataClient } from '@/shared/api';

import { ApiError, joinUrl, request, requestJson, type ODataListResponse, type ODataQuery } from '@/shared/api';

export interface FileApi {
  list(query: ODataQuery, signal?: AbortSignal): Promise<ODataListResponse<FileObjectDto>>;
  upload(file: File, description: string | undefined, signal?: AbortSignal): Promise<FileObjectDto>;
  downloadContent(id: string, signal?: AbortSignal): Promise<Blob>;
  remove(id: string, etag?: string, signal?: AbortSignal): Promise<void>;
}

export interface FileApiOptions {
  baseUrl: string;
  odata: ODataClient;
  getAccessToken: () => Promise<string | null>;
}

export function createFileApi(options: FileApiOptions): FileApi {
  const { baseUrl, odata } = options;

  async function requireToken(): Promise<string> {
    const token = await options.getAccessToken();
    if (!token) {
      throw new ApiError(401, 'No access token available');
    }
    return token;
  }

  return {
    list: (query, signal) => odata.list<FileObjectDto>('Files', query, signal),
    upload: async (file, description, signal) => {
      const form = new FormData();
      form.append('file', file);
      if (description !== undefined && description !== '') {
        form.append('description', description);
      }
      return requestJson<FileObjectDto>(joinUrl(baseUrl, '/api/v1/files'), {
        method: 'POST',
        body: form,
        rawBody: true,
        token: await requireToken(),
        signal,
      });
    },
    downloadContent: async (id, signal) => {
      const response = await request(joinUrl(baseUrl, `/api/v1/files/${encodeURIComponent(id)}/content`), {
        token: await requireToken(),
        accept: '*/*',
        signal,
      });
      return response.blob();
    },
    remove: (id, etag, signal) => odata.remove('Files', id, etag, signal),
  };
}
