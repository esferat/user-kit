import { fireEvent, render, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { FilesStore } from '../model/filesStore';

import { DocumentsPage } from './DocumentsPage';

import type { FileApi } from '@/entities/file';
import type { FileObjectDto } from '@/entities/file';

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

function renderPage(fileApi: FileApi) {
  return render(<DocumentsPage store={new FilesStore(fileApi)} />);
}

function searchInput(container: HTMLElement): HTMLElement & { value: string } {
  return container.querySelector('ui5-input') as HTMLElement & { value: string };
}

function sortSelect(container: HTMLElement): HTMLElement & { value: string } {
  return container.querySelector('ui5-toolbar-select') as HTMLElement & { value: string };
}

/** Панель инструментов содержит действия обновления и загрузки. */
function toolbarButton(container: HTMLElement, index: number): HTMLElement {
  return container.querySelectorAll('ui5-toolbar-button')[index] as HTMLElement;
}

function rows(container: HTMLElement): HTMLElement[] {
  return [...container.querySelectorAll('ui5-table-row')] as HTMLElement[];
}

function rowAction(container: HTMLElement, row: number, action: number): HTMLElement {
  return rows(container)[row].querySelectorAll('ui5-table-row-action')[action] as HTMLElement;
}

function dialogButtons(container: HTMLElement): (HTMLElement & { disabled: boolean })[] {
  return [...container.querySelectorAll('ui5-dialog ui5-button')] as (HTMLElement & { disabled: boolean })[];
}

function strip(container: HTMLElement): string | null {
  return container.querySelector('ui5-message-strip')?.textContent ?? null;
}

/** UI5 хранит выбранный файл загрузчика в read only свойстве. */
function chooseFile(container: HTMLElement, file: File): void {
  const uploader = container.querySelector('ui5-file-uploader') as HTMLElement;
  const transfer = new DataTransfer();
  transfer.items.add(file);
  Object.defineProperty(uploader, 'files', { configurable: true, get: () => transfer.files });
  fireEvent(uploader, new CustomEvent('change', { bubbles: true }));
}

async function openUpload(container: HTMLElement, file: File): Promise<void> {
  fireEvent.click(toolbarButton(container, 1));
  chooseFile(container, file);
  await waitFor(() => expect(dialogButtons(container)[1].disabled).toBe(false));
}

beforeEach(() => {
  i18n.setLocale('ru');
  window.location.hash = '';
});

describe('DocumentsPage', () => {
  it('loads the documents of the signed in user', async () => {
    const fileApi = createFileApi();
    const { container } = renderPage(fileApi);

    await waitFor(() => expect(rows(container)).toHaveLength(1));
    expect(container.querySelector('ui5-title')?.textContent).toBe(i18n.t('documents.title'));
    expect(fileApi.list).toHaveBeenCalledWith({
      filter: undefined,
      orderBy: [{ property: 'createdAt', descending: true }],
      top: 50,
      count: true,
    });
  });

  it('offers search, sorting, refresh and upload', async () => {
    const { container } = renderPage(createFileApi());
    await waitFor(() => expect(rows(container)).toHaveLength(1));

    expect(searchInput(container).getAttribute('accessible-name')).toBe(i18n.t('documents.search'));
    expect(searchInput(container).getAttribute('placeholder')).toBe(i18n.t('documents.search'));
    expect(sortSelect(container).getAttribute('accessible-name')).toBe(i18n.t('documents.sort.label'));
    expect(sortSelect(container).value).toBe('createdAt-desc');
    expect(
      [...sortSelect(container).querySelectorAll('ui5-toolbar-select-option')].map((option) => option.textContent),
    ).toEqual([
      i18n.t('documents.sort.newest'),
      i18n.t('documents.sort.oldest'),
      i18n.t('documents.sort.name'),
      i18n.t('documents.sort.sizeDesc'),
    ]);
    expect(toolbarButton(container, 0).getAttribute('accessible-name')).toBe(i18n.t('documents.refresh'));
    expect(toolbarButton(container, 1).getAttribute('text')).toBe(i18n.t('documents.upload'));
  });

  it('searches by name on every keystroke', async () => {
    const fileApi = createFileApi();
    const { container } = renderPage(fileApi);
    await waitFor(() => expect(rows(container)).toHaveLength(1));

    searchInput(container).value = 'report';
    fireEvent(searchInput(container), new CustomEvent('input', { bubbles: true }));

    await waitFor(() => expect(fileApi.list).toHaveBeenCalledTimes(2));
    expect(fileApi.list).toHaveBeenLastCalledWith(
      expect.objectContaining({
        filter: { kind: 'function', name: 'contains', property: 'name', value: 'report' },
      }),
    );
  });

  it('ignores a search term of blank characters', async () => {
    const fileApi = createFileApi();
    const { container } = renderPage(fileApi);
    await waitFor(() => expect(rows(container)).toHaveLength(1));

    searchInput(container).value = '   ';
    fireEvent(searchInput(container), new CustomEvent('input', { bubbles: true }));

    // Запрос не меняется, поэтому стор больше не обращается к backend.
    expect(fileApi.list).toHaveBeenCalledOnce();
    expect(rows(container)).toHaveLength(1);
  });

  it('reloads with the chosen order', async () => {
    const fileApi = createFileApi();
    const { container } = renderPage(fileApi);
    await waitFor(() => expect(rows(container)).toHaveLength(1));

    fireEvent(
      sortSelect(container),
      new CustomEvent('change', { bubbles: true, detail: { selectedOption: { value: 'name-asc' } } }),
    );

    await waitFor(() => expect(fileApi.list).toHaveBeenCalledTimes(2));
    expect(fileApi.list).toHaveBeenLastCalledWith(expect.objectContaining({ orderBy: [{ property: 'name' }] }));
  });

  it('reports a failed reload', async () => {
    const fileApi = createFileApi();
    fileApi.list = vi.fn(async () => {
      throw new Error('backend is down');
    });
    const { container } = renderPage(fileApi);

    await waitFor(() => expect(strip(container)).toContain('backend is down'));
    expect(rows(container)).toHaveLength(0);
  });

  it('uploads the files of the dialog and reloads the list', async () => {
    const fileApi = createFileApi();
    const { container } = renderPage(fileApi);
    await waitFor(() => expect(rows(container)).toHaveLength(1));
    await openUpload(container, new File(['payload'], 'next.txt', { type: 'text/plain' }));

    fireEvent.click(dialogButtons(container)[1]);

    await waitFor(() =>
      expect(fileApi.upload).toHaveBeenCalledWith(expect.objectContaining({ name: 'next.txt' }), undefined),
    );
    await waitFor(() => expect(fileApi.list).toHaveBeenCalledTimes(2));
    expect(strip(container)).toContain(i18n.t('documents.message.uploaded', { count: 1 }));
  });

  it('keeps the dialog open and reports a failed upload', async () => {
    const fileApi = createFileApi();
    fileApi.upload = vi.fn(async () => {
      throw new Error('file too large');
    });
    const { container } = renderPage(fileApi);
    await waitFor(() => expect(rows(container)).toHaveLength(1));
    await openUpload(container, new File(['payload'], 'next.txt'));

    fireEvent.click(dialogButtons(container)[1]);

    await waitFor(() => expect(strip(container)).toContain('file too large'));
    expect(fileApi.list).toHaveBeenCalledOnce();
  });

  it('closes the dialog without uploading on cancel', async () => {
    const fileApi = createFileApi();
    const { container } = renderPage(fileApi);
    await waitFor(() => expect(rows(container)).toHaveLength(1));
    await openUpload(container, new File(['payload'], 'next.txt'));

    fireEvent.click(dialogButtons(container)[0]);

    await waitFor(() =>
      expect((container.querySelector('ui5-dialog') as HTMLElement & { open: boolean }).open).toBe(false),
    );
    expect(fileApi.upload).not.toHaveBeenCalled();
  });

  it('downloads a document and offers it to the browser', async () => {
    const fileApi = createFileApi();
    const { container } = renderPage(fileApi);
    await waitFor(() => expect(rows(container)).toHaveLength(1));

    fireEvent.click(rowAction(container, 0, 0));

    await waitFor(() => expect(fileApi.downloadContent).toHaveBeenCalledWith('file-1'));
    expect(downloadBlob).toHaveBeenCalledWith(expect.any(Blob), 'report.txt');
    expect(strip(container)).toContain(i18n.t('documents.message.downloaded', { name: 'report.txt' }));
  });

  it('reports a failed download', async () => {
    const fileApi = createFileApi();
    fileApi.downloadContent = vi.fn(async () => {
      throw new Error('stream broken');
    });
    const { container } = renderPage(fileApi);
    await waitFor(() => expect(rows(container)).toHaveLength(1));

    fireEvent.click(rowAction(container, 0, 0));

    await waitFor(() => expect(strip(container)).toContain('stream broken'));
    expect(downloadBlob).not.toHaveBeenCalled();
  });

  it('deletes a document with its version tag and reloads the list', async () => {
    const fileApi = createFileApi();
    const { container } = renderPage(fileApi);
    await waitFor(() => expect(rows(container)).toHaveLength(1));

    fireEvent.click(rowAction(container, 0, 1));
    fireEvent.click(dialogButtons(container)[1]);

    await waitFor(() => expect(fileApi.remove).toHaveBeenCalledWith('file-1', 'W/"1"'));
    await waitFor(() => expect(rows(container)).toHaveLength(0));
    expect(strip(container)).toContain(i18n.t('documents.message.deleted', { name: 'report.txt' }));
  });

  it('reports a rejected delete and keeps the row', async () => {
    const fileApi = createFileApi();
    fileApi.remove = vi.fn(async () => {
      throw new Error('delete rejected');
    });
    const { container } = renderPage(fileApi);
    await waitFor(() => expect(rows(container)).toHaveLength(1));

    fireEvent.click(rowAction(container, 0, 1));
    fireEvent.click(dialogButtons(container)[1]);

    await waitFor(() => expect(strip(container)).toContain('delete rejected'));
    expect(rows(container)).toHaveLength(1);
  });

  it('keeps an action message across a reload of the list', async () => {
    const fileApi = createFileApi();
    const { container } = renderPage(fileApi);
    await waitFor(() => expect(rows(container)).toHaveLength(1));

    fireEvent.click(rowAction(container, 0, 1));
    fireEvent.click(dialogButtons(container)[1]);
    await waitFor(() => expect(rows(container)).toHaveLength(0));
    expect(strip(container)).toContain(i18n.t('documents.message.deleted', { name: 'report.txt' }));

    searchInput(container).value = 'report';
    fireEvent(searchInput(container), new CustomEvent('input', { bubbles: true }));

    await waitFor(() => expect(fileApi.list).toHaveBeenCalledTimes(3));
    expect(strip(container)).toBeNull();
  });

  it('keeps an action message across a sort of the list', async () => {
    const fileApi = createFileApi();
    const { container } = renderPage(fileApi);
    await waitFor(() => expect(rows(container)).toHaveLength(1));

    fireEvent.click(rowAction(container, 0, 0));
    await waitFor(() =>
      expect(strip(container)).toContain(i18n.t('documents.message.downloaded', { name: 'report.txt' })),
    );

    fireEvent(
      sortSelect(container),
      new CustomEvent('change', { bubbles: true, detail: { selectedOption: { value: 'name-asc' } } }),
    );

    await waitFor(() => expect(fileApi.list).toHaveBeenCalledTimes(2));
    expect(strip(container)).toBeNull();
  });

  it('drops the message on an explicit refresh', async () => {
    const fileApi = createFileApi();
    const { container } = renderPage(fileApi);
    await waitFor(() => expect(rows(container)).toHaveLength(1));

    fireEvent.click(rowAction(container, 0, 0));
    await waitFor(() => expect(strip(container)).not.toBeNull());

    fireEvent.click(toolbarButton(container, 0));

    await waitFor(() => expect(fileApi.list).toHaveBeenCalledTimes(2));
    expect(strip(container)).toBeNull();
  });

  it('forgets a rejected search and recovers on retry', async () => {
    const fileApi = createFileApi();
    let failed = false;
    fileApi.list = vi.fn(async () => {
      if (!failed) {
        failed = true;
        throw new Error('backend is down');
      }
      return { value: [FILE], count: 1 };
    });
    const { container } = renderPage(fileApi);

    await waitFor(() => expect(strip(container)).toContain('backend is down'));
    fireEvent.click(toolbarButton(container, 0));

    await waitFor(() => expect(rows(container)).toHaveLength(1));
    expect(strip(container)).toBeNull();
  });
});
