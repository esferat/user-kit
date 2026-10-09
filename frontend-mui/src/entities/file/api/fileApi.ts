import type { FileObjectDto } from '../model/types';

import { joinUrl, request, requestJson, type PageResponse } from '@/shared/api';

/** Параметры списка: поиск по имени, описанию и владельцу, сортировка, страница. */
export interface FileListQuery {
  search?: string;
  /** Свойство с необязательным ведущим минусом для убывания, например `-createdAt`. */
  sort?: string;
  page?: number;
  size?: number;
}

export interface FileApi {
  list(query?: FileListQuery, signal?: AbortSignal): Promise<PageResponse<FileObjectDto>>;
  upload(file: File, description: string | undefined, signal?: AbortSignal): Promise<FileObjectDto>;
  downloadContent(id: string, signal?: AbortSignal): Promise<Blob>;
  remove(id: string, etag?: string, signal?: AbortSignal): Promise<void>;
}

export interface FileApiOptions {
  baseUrl: string;
}

function fileListUrl(baseUrl: string, query: FileListQuery = {}): string {
  const url = joinUrl(baseUrl, '/api/v1/files');
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

export function createFileApi(options: FileApiOptions): FileApi {
  const { baseUrl } = options;

  return {
    list: (query, signal) => requestJson<PageResponse<FileObjectDto>>(fileListUrl(baseUrl, query), { signal }),
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
    remove: async (id, etag, signal) => {
      await request(joinUrl(baseUrl, `/api/v1/files/${encodeURIComponent(id)}`), {
        method: 'DELETE',
        signal,
        headers: etag === undefined ? {} : { 'If-Match': etag },
      });
    },
  };
}
