import { configureStore } from '@reduxjs/toolkit';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  buildFilesQuery,
  documentsReducer,
  downloadDocument,
  listDocuments,
  openUpload,
  refreshDocuments,
  removeDocument,
  searchDocuments,
  selectDocuments,
  sortDocuments,
  uploadDocuments,
} from './documentsSlice';

import type { FileApi, FileObjectDto } from '@/entities/file';

import { i18n } from '@/shared/i18n';

vi.mock('@/features/file-download', () => ({ downloadBlob: vi.fn() }));

const { downloadBlob } = vi.mocked(await import('@/features/file-download'));

const FILE: FileObjectDto = {
  id: 'file-1',
  name: 'report.txt',
  description: null,
  contentType: 'text/plain',
  sizeBytes: 2048,
  ownerId: 'user-1',
  ownerEmail: 'jane@user-kit.local',
  createdAt: '2026-02-10T09:15:00Z',
  updatedAt: '2026-02-11T10:20:00Z',
  etag: 'W/"1"',
};

function createFileApi(files: FileObjectDto[] = [FILE]): FileApi {
  let list = files;
  return {
    list: vi.fn(async () => ({ value: list, count: list.length })),
    upload: vi.fn(async () => ({ ...FILE, id: 'file-2', name: 'next.txt' })),
    downloadContent: vi.fn(async () => new Blob(['payload'])),
    remove: vi.fn(async () => {
      list = list.filter((file) => file.id !== FILE.id);
    }),
  };
}

function createStore(fileApi: FileApi) {
  return configureStore({
    reducer: { documents: documentsReducer },
    middleware: (getDefault) => getDefault({ thunk: { extraArgument: { services: { fileApi } } } }),
  });
}

beforeEach(() => {
  i18n.setLocale('ru');
  vi.clearAllMocks();
});

describe('buildFilesQuery', () => {
  it('lists without a filter for an empty search', () => {
    expect(buildFilesQuery('', 'createdAt-desc')).toEqual({
      filter: undefined,
      orderBy: [{ property: 'createdAt', descending: true }],
      top: 50,
      count: true,
    });
  });

  it('orders by name when the sort asks for it', () => {
    expect(buildFilesQuery('', 'name-asc').orderBy).toEqual([{ property: 'name' }]);
  });

  it('searches the name ignoring the wrapping whitespace', () => {
    expect(buildFilesQuery('  report  ', 'createdAt-desc').filter).toEqual({
      kind: 'function',
      name: 'contains',
      property: 'name',
      value: 'report',
    });
  });
});

describe('documentsSlice', () => {
  it('lists the documents of the signed in user', async () => {
    const fileApi = createFileApi();
    const store = createStore(fileApi);

    await store.dispatch(listDocuments());

    expect(fileApi.list).toHaveBeenCalledWith(buildFilesQuery('', 'createdAt-desc'));
    expect(selectDocuments(store.getState()).files).toEqual([FILE]);
    expect(selectDocuments(store.getState()).loading).toBe(false);
  });

  it('reports a failed list as a message', async () => {
    const fileApi = createFileApi();
    fileApi.list = vi.fn(async () => {
      throw new Error('backend is down');
    });
    const store = createStore(fileApi);

    await store.dispatch(listDocuments());

    const state = selectDocuments(store.getState());
    expect(state.files).toEqual([]);
    expect(state.message?.text).toBe('backend is down');
    expect(state.message?.design).toBe('Error');
  });

  it('searches on every effective change of the term', async () => {
    const fileApi = createFileApi();
    const store = createStore(fileApi);
    await store.dispatch(listDocuments());

    await store.dispatch(searchDocuments('report'));

    expect(fileApi.list).toHaveBeenLastCalledWith(
      expect.objectContaining({
        filter: { kind: 'function', name: 'contains', property: 'name', value: 'report' },
      }),
    );
  });

  it('skips a reload for a blank search', async () => {
    const fileApi = createFileApi();
    const store = createStore(fileApi);
    await store.dispatch(listDocuments());

    await store.dispatch(searchDocuments('   '));

    expect(fileApi.list).toHaveBeenCalledOnce();
    expect(selectDocuments(store.getState()).search).toBe('   ');
  });

  it('sorts the list and reloads it', async () => {
    const fileApi = createFileApi();
    const store = createStore(fileApi);
    await store.dispatch(listDocuments());

    await store.dispatch(sortDocuments('name-asc'));

    expect(fileApi.list).toHaveBeenLastCalledWith(expect.objectContaining({ orderBy: [{ property: 'name' }] }));
    expect(selectDocuments(store.getState()).sort).toBe('name-asc');
  });

  it('does not reload for the same sort', async () => {
    const fileApi = createFileApi();
    const store = createStore(fileApi);
    await store.dispatch(listDocuments());

    await store.dispatch(sortDocuments('createdAt-desc'));

    expect(fileApi.list).toHaveBeenCalledOnce();
  });

  it('reloads on a refresh and drops the shown message', async () => {
    const fileApi = createFileApi();
    const store = createStore(fileApi);
    await store.dispatch(listDocuments());
    await store.dispatch(uploadDocuments({ files: [new File(['payload'], 'next.txt')], description: undefined }));
    expect(selectDocuments(store.getState()).message?.design).toBe('Success');

    await store.dispatch(refreshDocuments());

    expect(fileApi.list).toHaveBeenCalledTimes(3);
    expect(selectDocuments(store.getState()).message).toBeUndefined();
  });

  it('uploads the chosen files and reloads the list', async () => {
    const fileApi = createFileApi();
    const store = createStore(fileApi);
    await store.dispatch(listDocuments());

    await store.dispatch(uploadDocuments({ files: [new File(['payload'], 'next.txt')], description: 'numbers' }));

    expect(fileApi.upload).toHaveBeenCalledWith(expect.any(File), 'numbers');
    const state = selectDocuments(store.getState());
    expect(state.uploadOpen).toBe(false);
    expect(state.message?.design).toBe('Success');
    expect(state.submitting).toBe(false);
    expect(fileApi.list).toHaveBeenCalledTimes(2);
  });

  it('keeps the dialog open and reports a failed upload', async () => {
    const fileApi = createFileApi();
    fileApi.upload = vi.fn(async () => {
      throw new Error('file too large');
    });
    const store = createStore(fileApi);
    await store.dispatch(listDocuments());
    store.dispatch(openUpload());

    await store.dispatch(uploadDocuments({ files: [new File(['payload'], 'next.txt')], description: undefined }));

    const state = selectDocuments(store.getState());
    expect(state.message?.text).toBe('file too large');
    expect(state.message?.design).toBe('Error');
    expect(state.uploadOpen).toBe(true);
    expect(state.submitting).toBe(false);
    expect(fileApi.list).toHaveBeenCalledOnce();
  });

  it('downloads a document and offers it to the browser', async () => {
    const fileApi = createFileApi();
    const store = createStore(fileApi);

    await store.dispatch(downloadDocument(FILE));

    expect(fileApi.downloadContent).toHaveBeenCalledWith('file-1');
    expect(downloadBlob).toHaveBeenCalledWith(expect.any(Blob), 'report.txt');
    expect(selectDocuments(store.getState()).message?.design).toBe('Success');
  });

  it('reports a failed download', async () => {
    const fileApi = createFileApi();
    fileApi.downloadContent = vi.fn(async () => {
      throw new Error('stream broken');
    });
    const store = createStore(fileApi);

    await store.dispatch(downloadDocument(FILE));

    expect(downloadBlob).not.toHaveBeenCalled();
    expect(selectDocuments(store.getState()).message?.text).toBe('stream broken');
  });

  it('removes a document with its version tag and reloads the list', async () => {
    const fileApi = createFileApi();
    const store = createStore(fileApi);
    await store.dispatch(listDocuments());

    await store.dispatch(removeDocument(FILE));

    expect(fileApi.remove).toHaveBeenCalledWith('file-1', 'W/"1"');
    expect(selectDocuments(store.getState()).files).toEqual([]);
    expect(selectDocuments(store.getState()).message?.design).toBe('Success');
    expect(fileApi.list).toHaveBeenCalledTimes(2);
  });

  it('reports a rejected delete without reloading', async () => {
    const fileApi = createFileApi();
    fileApi.remove = vi.fn(async () => {
      throw new Error('delete rejected');
    });
    const store = createStore(fileApi);
    await store.dispatch(listDocuments());

    await store.dispatch(removeDocument(FILE));

    expect(selectDocuments(store.getState()).message?.text).toBe('delete rejected');
    expect(fileApi.list).toHaveBeenCalledOnce();
    expect(selectDocuments(store.getState()).files).toHaveLength(1);
  });
});
