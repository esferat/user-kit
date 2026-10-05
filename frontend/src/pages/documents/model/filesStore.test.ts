import { autorun } from 'mobx';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { FilesStore } from './filesStore';

import type { FileApi, FileObjectDto } from '@/entities/file';

import { i18n } from '@/shared/i18n';

vi.mock('@/features/file-download', () => ({
  downloadBlob: vi.fn(),
}));

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

const { downloadBlob } = vi.mocked(await import('@/features/file-download'));

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

beforeEach(() => {
  i18n.setLocale('ru');
});

describe('FilesStore', () => {
  it('asks for the newest documents first', () => {
    const store = new FilesStore(createFileApi());

    expect(store.query).toEqual({
      filter: undefined,
      orderBy: [{ property: 'createdAt', descending: true }],
      top: 50,
      count: true,
    });
    expect(store.files).toEqual([]);
    expect(store.loading).toBe(false);
  });

  it('filters by the search term', () => {
    const store = new FilesStore(createFileApi());

    store.setSearch('  report  ');

    expect(store.query.filter).toEqual({ kind: 'function', name: 'contains', property: 'name', value: 'report' });
  });

  it('ignores a search term of blank characters', () => {
    const store = new FilesStore(createFileApi());

    store.setSearch('   ');

    expect(store.query.filter).toBeUndefined();
  });

  it('maps every ordering onto an order by clause', () => {
    const store = new FilesStore(createFileApi());

    store.setSort('name-asc');
    expect(store.query.orderBy).toEqual([{ property: 'name' }]);

    store.setSort('sizeBytes-desc');
    expect(store.query.orderBy).toEqual([{ property: 'sizeBytes', descending: true }]);
  });

  it('keeps the ordering when the same one is chosen again', async () => {
    const fileApi = createFileApi();
    const store = new FilesStore(fileApi);
    const stop = store.start();
    await vi.waitFor(() => expect(store.files).toHaveLength(1));

    store.setSort('createdAt-desc');

    expect(fileApi.list).toHaveBeenCalledOnce();
    stop();
  });

  it('requests the list when it is started', async () => {
    const fileApi = createFileApi();
    const store = new FilesStore(fileApi);

    const stop = store.start();

    await vi.waitFor(() => expect(store.files).toHaveLength(1));
    expect(fileApi.list).toHaveBeenCalledOnce();
    stop();
  });

  it('starts the request again on every change of the query', async () => {
    const fileApi = createFileApi();
    const store = new FilesStore(fileApi);
    const stop = store.start();
    await vi.waitFor(() => expect(store.files).toHaveLength(1));

    store.setSearch('report');
    await vi.waitFor(() => expect(fileApi.list).toHaveBeenCalledTimes(2));

    store.setSort('name-asc');
    await vi.waitFor(() => expect(fileApi.list).toHaveBeenCalledTimes(3));
    stop();
  });

  it('stops requesting once it is stopped', async () => {
    const fileApi = createFileApi();
    const store = new FilesStore(fileApi);
    const stop = store.start();
    await vi.waitFor(() => expect(store.files).toHaveLength(1));

    stop();
    store.setSearch('report');

    expect(fileApi.list).toHaveBeenCalledOnce();
  });

  it('starts the reactions only once', async () => {
    const fileApi = createFileApi();
    const store = new FilesStore(fileApi);

    const first = store.start();
    const second = store.start();

    await vi.waitFor(() => expect(store.files).toHaveLength(1));
    expect(fileApi.list).toHaveBeenCalledOnce();
    first();
    second();
  });

  it('reports a failed request as a message', async () => {
    const fileApi = createFileApi();
    fileApi.list = vi.fn(async () => {
      throw new Error('backend is down');
    });
    const store = new FilesStore(fileApi);
    const stop = store.start();

    await vi.waitFor(() => expect(store.message?.text).toBe('backend is down'));
    expect(store.message?.design).toBe('Error');
    stop();
  });

  it('keeps the documents on screen while a reload fails', async () => {
    const fileApi = createFileApi();
    const store = new FilesStore(fileApi);
    const stop = store.start();
    await vi.waitFor(() => expect(store.files).toHaveLength(1));

    fileApi.list = vi.fn(async () => {
      throw new Error('backend is down');
    });
    await store.refresh();

    expect(store.files).toHaveLength(1);
    expect(store.error).toBeInstanceOf(Error);
    stop();
  });

  it('uploads every file of the dialog and reloads the list', async () => {
    const fileApi = createFileApi();
    const store = new FilesStore(fileApi);
    const stop = store.start();
    await vi.waitFor(() => expect(store.files).toHaveLength(1));
    store.openUpload();

    await store.upload([new File(['a'], 'a.txt'), new File(['b'], 'b.txt')], 'quarterly');

    expect(fileApi.upload).toHaveBeenCalledTimes(2);
    expect(fileApi.upload).toHaveBeenNthCalledWith(1, expect.objectContaining({ name: 'a.txt' }), 'quarterly');
    expect(store.uploadOpen).toBe(false);
    expect(store.submitting).toBe(false);
    expect(store.message?.text).toBe(i18n.t('documents.message.uploaded', { count: 2 }));
    expect(fileApi.list).toHaveBeenCalledTimes(2);
    stop();
  });

  it('keeps the dialog ready for a retry after a failed upload', async () => {
    const fileApi = createFileApi();
    fileApi.upload = vi.fn(async () => {
      throw new Error('file too large');
    });
    const store = new FilesStore(fileApi);
    const stop = store.start();
    await vi.waitFor(() => expect(store.files).toHaveLength(1));
    store.openUpload();

    await store.upload([new File(['a'], 'a.txt')], undefined);

    expect(store.message?.text).toBe('file too large');
    expect(store.uploadOpen).toBe(true);
    expect(store.submitting).toBe(false);
    expect(fileApi.list).toHaveBeenCalledOnce();
    stop();
  });

  it('offers a download to the browser', async () => {
    const fileApi = createFileApi();
    const store = new FilesStore(fileApi);

    await store.download(FILE);

    expect(fileApi.downloadContent).toHaveBeenCalledWith('file-1');
    expect(downloadBlob).toHaveBeenCalledWith(expect.any(Blob), 'report.txt');
    expect(store.message?.text).toBe(i18n.t('documents.message.downloaded', { name: 'report.txt' }));
  });

  it('reports a failed download', async () => {
    const fileApi = createFileApi();
    fileApi.downloadContent = vi.fn(async () => {
      throw new Error('stream broken');
    });
    const store = new FilesStore(fileApi);

    await store.download(FILE);

    expect(store.message?.text).toBe('stream broken');
    expect(downloadBlob).not.toHaveBeenCalled();
  });

  it('deletes a document with its version tag and reloads the list', async () => {
    const fileApi = createFileApi();
    const store = new FilesStore(fileApi);
    const stop = store.start();
    await vi.waitFor(() => expect(store.files).toHaveLength(1));

    await store.remove(FILE);

    expect(fileApi.remove).toHaveBeenCalledWith('file-1', 'W/"1"');
    expect(store.files).toHaveLength(0);
    expect(store.message?.text).toBe(i18n.t('documents.message.deleted', { name: 'report.txt' }));
    stop();
  });

  it('reports a rejected delete and keeps the row', async () => {
    const fileApi = createFileApi();
    fileApi.remove = vi.fn(async () => {
      throw new Error('delete rejected');
    });
    const store = new FilesStore(fileApi);
    const stop = store.start();
    await vi.waitFor(() => expect(store.files).toHaveLength(1));

    await store.remove(FILE);

    expect(store.message?.text).toBe('delete rejected');
    expect(store.files).toHaveLength(1);
    stop();
  });

  it('drops the message when the query changes', async () => {
    const store = new FilesStore(createFileApi());
    store.message = { text: 'done', design: 'Success' };

    store.setSearch('report');

    expect(store.message).toBeUndefined();
  });

  it('notifies an observer about every state it renders', async () => {
    const store = new FilesStore(createFileApi());
    const seen: number[] = [];
    const stop = autorun(() => {
      seen.push(store.files.length);
    });
    const dispose = store.start();

    await vi.waitFor(() => expect(store.files).toHaveLength(1));
    dispose();
    stop();

    expect(seen).toEqual([0, 1]);
  });
});
