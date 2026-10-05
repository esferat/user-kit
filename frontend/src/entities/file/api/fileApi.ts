import type { FileObjectDto } from '../model/types';

import type { ODataClient } from '@/shared/api';

import { joinUrl, request, requestJson, type ODataListResponse, type ODataQuery } from '@/shared/api';

export interface FileApi {
  list(query: ODataQuery, signal?: AbortSignal): Promise<ODataListResponse<FileObjectDto>>;
  upload(file: File, description: string | undefined, signal?: AbortSignal): Promise<FileObjectDto>;
  downloadContent(id: string, signal?: AbortSignal): Promise<Blob>;
  remove(id: string, etag?: string, signal?: AbortSignal): Promise<void>;
}

export interface FileApiOptions {
  baseUrl: string;
  odata: ODataClient;
}

export function createFileApi(options: FileApiOptions): FileApi {
  const { baseUrl, odata } = options;

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
        signal,
      });
    },
    downloadContent: async (id, signal) => {
      const response = await request(joinUrl(baseUrl, `/api/v1/files/${encodeURIComponent(id)}/content`), {
        accept: '*/*',
        signal,
      });
      return response.blob();
    },
    remove: (id, etag, signal) => odata.remove('Files', id, etag, signal),
  };
}
