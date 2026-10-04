import '@ui5/webcomponents-icons/dist/AllIcons.js';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createDocumentsPage } from './documentsPage';

import type { FileApi, FileObjectDto } from '@/entities/file';
import { i18n } from '@/shared/i18n';

const files: FileObjectDto[] = [
  {
    id: 'f-1',
    name: 'hello.txt',
    description: 'greeting',
    contentType: 'text/plain',
    sizeBytes: 2048,
    ownerId: 'u-1',
    ownerEmail: 'jane@user-kit.local',
    createdAt: '2026-01-02T10:00:00Z',
    updatedAt: '2026-01-03T10:00:00Z',
    etag: 'W/"0"',
  },
];

const downloadMock = vi.hoisted(() => vi.fn());

vi.mock('@/features/file-download', () => ({
  downloadBlob: downloadMock,
}));

vi.mock('@ui5/webcomponents-base/dist/config/Theme.js', () => ({
  setTheme: vi.fn().mockResolvedValue(undefined),
}));

function createFileApi(overrides: Partial<FileApi> = {}): FileApi {
  return {
    list: vi.fn().mockResolvedValue({ value: files }),
    upload: vi.fn().mockResolvedValue(files[0]),
    downloadContent: vi.fn().mockResolvedValue(new Blob(['hello from the smoke test'])),
    remove: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  } as unknown as FileApi;
}

function rows(page: HTMLElement): Element[] {
  return [...page.querySelectorAll('ui5-table-row')];
}

function messages(page: HTMLElement): { text: string; design: string | null }[] {
  return [...page.querySelectorAll('ui5-message-strip')].map((strip) => ({
    text: strip.textContent ?? '',
    design: strip.getAttribute('design'),
  }));
}

function clickAction(page: HTMLElement, row: Element, index: number): void {
  const action = row.querySelectorAll('ui5-table-row-action')[index];
  page.querySelector('ui5-table')?.dispatchEvent(
    new CustomEvent('row-action-click', { detail: { action, row } }),
  );
}

function searchInput(page: HTMLElement): Element & { value: string } {
  return page.querySelector('ui5-input') as Element & { value: string };
}

function sortSelect(page: HTMLElement): Element & { value: string } {
  return page.querySelector('ui5-toolbar ui5-select') as Element & { value: string };
}

describe('createDocumentsPage', () => {
  beforeEach(() => {
    i18n.setLocale('ru');
    downloadMock.mockClear();
    document.body.replaceChildren();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders the title and the files on the first load', async () => {
    const fileApi = createFileApi();

    const page = createDocumentsPage({ fileApi });
    document.body.appendChild(page);

    expect(page.querySelector('ui5-title')?.textContent).toBe(i18n.t('documents.title'));
    await vi.waitFor(() => expect(rows(page)).toHaveLength(1));
    expect(fileApi.list).toHaveBeenCalledWith({
      filter: undefined,
      orderBy: [{ property: 'createdAt', descending: true }],
      top: 50,
      count: true,
    });
  });

  it('searches by name and reloads on every keystroke', async () => {
    const fileApi = createFileApi();
    const page = createDocumentsPage({ fileApi });
    document.body.appendChild(page);
    await vi.waitFor(() => expect(rows(page)).toHaveLength(1));

    searchInput(page).value = '  hello  ';
    searchInput(page).dispatchEvent(new CustomEvent('input'));

    await vi.waitFor(() =>
      expect(fileApi.list).toHaveBeenLastCalledWith(
        expect.objectContaining({
          filter: { kind: 'function', name: 'contains', property: 'name', value: 'hello' },
        }),
      ),
    );
  });

  it('sorts by name when the sort selection changes', async () => {
    const fileApi = createFileApi();
    const page = createDocumentsPage({ fileApi });
    document.body.appendChild(page);
    await vi.waitFor(() => expect(rows(page)).toHaveLength(1));

    const option = [...sortSelect(page).querySelectorAll('ui5-option')].find(
      (entry) => (entry as Element & { value: string }).value === 'name-asc',
    );
    sortSelect(page).dispatchEvent(new CustomEvent('change', { detail: { selectedOption: option } }));

    await vi.waitFor(() =>
      expect(fileApi.list).toHaveBeenLastCalledWith(
        expect.objectContaining({ orderBy: [{ property: 'name' }] }),
      ),
    );
  });

  it('downloads the content of a file', async () => {
    const fileApi = createFileApi();
    const page = createDocumentsPage({ fileApi });
    document.body.appendChild(page);
    await vi.waitFor(() => expect(rows(page)).toHaveLength(1));

    clickAction(page, rows(page)[0], 0);

    await vi.waitFor(() => expect(fileApi.downloadContent).toHaveBeenCalledWith('f-1'));
    await vi.waitFor(() =>
      expect(messages(page)[0]).toEqual({
        text: i18n.t('documents.message.downloaded', { name: 'hello.txt' }),
        design: 'Positive',
      }),
    );
    expect(downloadMock).toHaveBeenCalledOnce();
  });

  it('deletes a file with its etag and reloads the table', async () => {
    const fileApi = createFileApi();
    const page = createDocumentsPage({ fileApi });
    document.body.appendChild(page);
    await vi.waitFor(() => expect(rows(page)).toHaveLength(1));

    clickAction(page, rows(page)[0], 1);

    await vi.waitFor(() => expect(fileApi.remove).toHaveBeenCalledWith('f-1', 'W/"0"'));
    await vi.waitFor(() =>
      expect(messages(page)[0]).toEqual({
        text: i18n.t('documents.message.deleted', { name: 'hello.txt' }),
        design: 'Positive',
      }),
    );
    await vi.waitFor(() => expect(fileApi.list).toHaveBeenCalledTimes(2));
  });

  it('reports a failed download and delete', async () => {
    const fileApi = createFileApi({
      downloadContent: vi.fn().mockRejectedValue(new Error('storage unreachable')),
      remove: vi.fn().mockRejectedValue(new Error('412 precondition failed')),
    } as Partial<FileApi>);
    const page = createDocumentsPage({ fileApi });
    document.body.appendChild(page);
    await vi.waitFor(() => expect(rows(page)).toHaveLength(1));

    clickAction(page, rows(page)[0], 0);
    await vi.waitFor(() => expect(messages(page)[0]?.text).toBe('storage unreachable'));
    expect(messages(page)[0].design).toBe('Negative');

    clickAction(page, rows(page)[0], 1);
    await vi.waitFor(() => expect(messages(page)[0]?.text).toBe('412 precondition failed'));
    expect(downloadMock).not.toHaveBeenCalled();
  });

  it('reports a failed load', async () => {
    const fileApi = createFileApi({
      list: vi.fn().mockRejectedValue(new Error('backend unreachable')),
    } as Partial<FileApi>);

    const page = createDocumentsPage({ fileApi });
    document.body.appendChild(page);

    await vi.waitFor(() => expect(messages(page)[0]?.text).toBe('backend unreachable'));
    expect(rows(page)).toHaveLength(0);
  });

  it('uploads the files of the dialog and reloads the table', async () => {
    const fileApi = createFileApi();
    const page = createDocumentsPage({ fileApi });
    document.body.appendChild(page);
    await vi.waitFor(() => expect(rows(page)).toHaveLength(1));

    const upload = [...page.querySelectorAll('ui5-button')][0];
    const dialog = page.querySelector('ui5-dialog') as HTMLElement & { open: boolean };
    upload.dispatchEvent(new CustomEvent('click'));
    expect(dialog.open).toBe(true);

    const file = new File(['hello from the smoke test'], 'upload.txt', { type: 'text/plain' });
    const uploader = page.querySelector('ui5-file-uploader') as Element & { files?: FileList | null };
    Object.defineProperty(uploader, 'files', { configurable: true, value: [file] });
    uploader.dispatchEvent(new CustomEvent('change'));
    const confirm = page.querySelectorAll('ui5-dialog ui5-button')[1];
    confirm.dispatchEvent(new CustomEvent('click'));

    await vi.waitFor(() => expect(fileApi.upload).toHaveBeenCalledWith(file, undefined));
    await vi.waitFor(() =>
      expect(messages(page)[0]).toEqual({
        text: i18n.t('documents.message.uploaded', { count: 1 }),
        design: 'Positive',
      }),
    );
    await vi.waitFor(() => expect(fileApi.list).toHaveBeenCalledTimes(2));
  });

  it('reports a failed upload and keeps the dialog open', async () => {
    const fileApi = createFileApi({
      upload: vi.fn().mockRejectedValue(new Error('file too large')),
    } as Partial<FileApi>);
    const page = createDocumentsPage({ fileApi });
    document.body.appendChild(page);
    await vi.waitFor(() => expect(rows(page)).toHaveLength(1));

    const upload = [...page.querySelectorAll('ui5-button')][0];
    upload.dispatchEvent(new CustomEvent('click'));
    const file = new File(['hello from the smoke test'], 'upload.txt', { type: 'text/plain' });
    const uploader = page.querySelector('ui5-file-uploader') as Element & { files?: FileList | null };
    Object.defineProperty(uploader, 'files', { configurable: true, value: [file] });
    uploader.dispatchEvent(new CustomEvent('change'));
    page.querySelectorAll('ui5-dialog ui5-button')[1].dispatchEvent(new CustomEvent('click'));

    await vi.waitFor(() => expect(messages(page)[0]?.text).toBe('file too large'));
    expect(fileApi.list).toHaveBeenCalledTimes(1);
  });

  it('reloads the files with the refresh button', async () => {
    const fileApi = createFileApi();
    const page = createDocumentsPage({ fileApi });
    document.body.appendChild(page);
    await vi.waitFor(() => expect(rows(page)).toHaveLength(1));

    const buttons = [...page.querySelectorAll('ui5-toolbar ui5-button')];
    buttons.at(-1)?.dispatchEvent(new CustomEvent('click'));

    await vi.waitFor(() => expect(fileApi.list).toHaveBeenCalledTimes(2));
  });
});
