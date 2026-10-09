import { configureStore } from '@reduxjs/toolkit';
import { fireEvent, render, waitFor } from '@testing-library/react';
import { Provider } from 'react-redux';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { documentsReducer } from '../model/documentsSlice';

import { DocumentsPage } from './DocumentsPage';

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
    list: vi.fn(async () => ({ items: list, total: list.length, page: 0, size: 50 })),
    upload: vi.fn(async () => ({ ...FILE, id: 'file-2', name: 'next.txt' })),
    downloadContent: vi.fn(async () => new Blob(['payload'])),
    remove: vi.fn(async () => {
      list = list.filter((file) => file.id !== FILE.id);
    }),
  };
}

function renderPage(fileApi: FileApi) {
  const store = configureStore({
    reducer: { documents: documentsReducer },
    middleware: (getDefault) => getDefault({ thunk: { extraArgument: { services: { fileApi } } } }),
  });
  return render(
    <Provider store={store}>
      <DocumentsPage />
    </Provider>,
  );
}

function params(container: HTMLElement): HTMLElement {
  return container.querySelector('.page-toolbar-fields') as HTMLElement;
}

function searchInput(container: HTMLElement): HTMLInputElement {
  return params(container).querySelector('input[aria-label][placeholder]') as HTMLInputElement;
}

function sortSelect(container: HTMLElement): HTMLElement {
  return params(container).querySelector('.MuiSelect-select[aria-label]') as HTMLElement;
}

function actions(container: HTMLElement): HTMLElement {
  return container.querySelector('.page-toolbar-actions') as HTMLElement;
}

function refreshButton(container: HTMLElement): HTMLButtonElement {
  return actions(container).querySelector('button[aria-label]') as HTMLButtonElement;
}

function uploadButton(container: HTMLElement): HTMLButtonElement {
  return actions(container).querySelector('button:not([aria-label])') as HTMLButtonElement;
}

function rows(container: HTMLElement): HTMLElement[] {
  return [...container.querySelectorAll('tbody tr.table-row')] as HTMLElement[];
}

function rowAction(container: HTMLElement, row: number, action: number): HTMLButtonElement {
  return rows(container)[row].querySelectorAll('td:last-child button')[action] as HTMLButtonElement;
}

function dialogButtons(root: HTMLElement): HTMLButtonElement[] {
  return [...root.querySelectorAll<HTMLButtonElement>('.MuiDialogActions-root button')];
}

function alert(container: HTMLElement): string | null {
  return container.querySelector('[role="alert"]')?.textContent ?? null;
}

function chooseFile(root: HTMLElement, file: File): void {
  const input = root.querySelector('input[type="file"]') as HTMLInputElement;
  Object.defineProperty(input, 'files', { configurable: true, value: [file] });
  fireEvent.change(input);
}

function chooseSort(container: HTMLElement, sort: string): void {
  fireEvent.mouseDown(sortSelect(container));
  const option = [...document.querySelectorAll('.MuiMenuItem-root')].find(
    (entry) => entry.textContent === i18n.t(`documents.sort.${sort}`),
  );
  if (option) {
    fireEvent.click(option);
  }
}

async function openUpload(root: HTMLElement, file: File): Promise<void> {
  fireEvent.click(uploadButton(root));
  await waitFor(() => expect(root.querySelector('input[type="file"]')).not.toBeNull());
  chooseFile(root, file);
  await waitFor(() => expect(dialogButtons(root)[1].disabled).toBe(false));
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
    expect(container.querySelector('.page-title')?.textContent).toBe(i18n.t('documents.title'));
    expect(fileApi.list).toHaveBeenCalledWith({ search: '', sort: '-createdAt', size: 50 });
  });

  it('offers search, sorting, refresh and upload', async () => {
    const { container } = renderPage(createFileApi());
    await waitFor(() => expect(rows(container)).toHaveLength(1));

    expect(searchInput(container).getAttribute('aria-label')).toBe(i18n.t('documents.search'));
    expect(searchInput(container).getAttribute('placeholder')).toBe(i18n.t('documents.search'));
    expect(sortSelect(container).getAttribute('aria-label')).toBe(i18n.t('documents.sort.label'));
    expect(refreshButton(container).getAttribute('aria-label')).toBe(i18n.t('documents.refresh'));
    expect(uploadButton(container).textContent).toBe(i18n.t('documents.upload'));
  });

  it('searches by name on every keystroke', async () => {
    const fileApi = createFileApi();
    const { container } = renderPage(fileApi);
    await waitFor(() => expect(rows(container)).toHaveLength(1));

    fireEvent.change(searchInput(container), { target: { value: 'report' } });

    await waitFor(() => expect(fileApi.list).toHaveBeenCalledTimes(2));
    expect(fileApi.list).toHaveBeenLastCalledWith(expect.objectContaining({ search: 'report' }));
  });

  it('ignores a search term of blank characters', async () => {
    const fileApi = createFileApi();
    const { container } = renderPage(fileApi);
    await waitFor(() => expect(rows(container)).toHaveLength(1));

    fireEvent.change(searchInput(container), { target: { value: '   ' } });

    // Запрос не меняется, поэтому страница больше не обращается к backend.
    expect(fileApi.list).toHaveBeenCalledOnce();
    expect(rows(container)).toHaveLength(1);
  });

  it('reloads with the chosen order', async () => {
    const fileApi = createFileApi();
    const { container } = renderPage(fileApi);
    await waitFor(() => expect(rows(container)).toHaveLength(1));

    chooseSort(container, 'name');

    await waitFor(() => expect(fileApi.list).toHaveBeenCalledTimes(2));
    expect(fileApi.list).toHaveBeenLastCalledWith(expect.objectContaining({ sort: 'name' }));
  });

  it('reports a failed reload', async () => {
    const fileApi = createFileApi();
    fileApi.list = vi.fn(async () => {
      throw new Error('backend is down');
    });
    const { container } = renderPage(fileApi);

    await waitFor(() => expect(alert(container)).toContain('backend is down'));
    expect(rows(container)).toHaveLength(0);
  });

  it('uploads the files of the dialog and reloads the list', async () => {
    const fileApi = createFileApi();
    const { container, baseElement } = renderPage(fileApi);
    await waitFor(() => expect(rows(container)).toHaveLength(1));
    await openUpload(baseElement, new File(['payload'], 'next.txt', { type: 'text/plain' }));

    fireEvent.click(dialogButtons(baseElement)[1]);

    await waitFor(() =>
      expect(fileApi.upload).toHaveBeenCalledWith(expect.objectContaining({ name: 'next.txt' }), undefined),
    );
    await waitFor(() => expect(fileApi.list).toHaveBeenCalledTimes(2));
    expect(alert(container)).toContain(i18n.t('documents.message.uploaded', { count: 1 }));
  });

  it('keeps the dialog open and reports a failed upload', async () => {
    const fileApi = createFileApi();
    fileApi.upload = vi.fn(async () => {
      throw new Error('file too large');
    });
    const { container, baseElement } = renderPage(fileApi);
    await waitFor(() => expect(rows(container)).toHaveLength(1));
    await openUpload(baseElement, new File(['payload'], 'next.txt'));

    fireEvent.click(dialogButtons(baseElement)[1]);

    await waitFor(() => expect(alert(container)).toContain('file too large'));
    expect(fileApi.list).toHaveBeenCalledOnce();
    // Диалог остаётся готовым к повтору: файлы всё ещё перечислены, а кнопка
    // подтверждения снова доступна.
    expect(baseElement.querySelector('.upload-list')).not.toBeNull();
    await waitFor(() => expect(dialogButtons(baseElement)[1].disabled).toBe(false));
  });

  it('closes the dialog without uploading on cancel', async () => {
    const fileApi = createFileApi();
    const { container, baseElement } = renderPage(fileApi);
    await waitFor(() => expect(rows(container)).toHaveLength(1));
    await openUpload(baseElement, new File(['payload'], 'next.txt'));

    fireEvent.click(dialogButtons(baseElement)[0]);

    // Страница только закрывает диалог; исчезает ли он на самом деле — это
    // поведение самого диалога, которое `UploadDialog` покрывает отдельно.
    expect(fileApi.upload).not.toHaveBeenCalled();
    expect(fileApi.list).toHaveBeenCalledOnce();
  });

  it('downloads a document and offers it to the browser', async () => {
    const fileApi = createFileApi();
    const { container } = renderPage(fileApi);
    await waitFor(() => expect(rows(container)).toHaveLength(1));

    fireEvent.click(rowAction(container, 0, 0));

    await waitFor(() => expect(fileApi.downloadContent).toHaveBeenCalledWith('file-1'));
    expect(downloadBlob).toHaveBeenCalledWith(expect.any(Blob), 'report.txt');
    expect(alert(container)).toContain(i18n.t('documents.message.downloaded', { name: 'report.txt' }));
  });

  it('reports a failed download', async () => {
    const fileApi = createFileApi();
    fileApi.downloadContent = vi.fn(async () => {
      throw new Error('stream broken');
    });
    const { container } = renderPage(fileApi);
    await waitFor(() => expect(rows(container)).toHaveLength(1));

    fireEvent.click(rowAction(container, 0, 0));

    await waitFor(() => expect(alert(container)).toContain('stream broken'));
    expect(downloadBlob).not.toHaveBeenCalled();
  });

  it('deletes a document with its version tag and reloads the list', async () => {
    const fileApi = createFileApi();
    const { container } = renderPage(fileApi);
    await waitFor(() => expect(rows(container)).toHaveLength(1));

    fireEvent.click(rowAction(container, 0, 1));

    await waitFor(() => expect(fileApi.remove).toHaveBeenCalledWith('file-1', 'W/"1"'));
    await waitFor(() => expect(rows(container)).toHaveLength(0));
    expect(alert(container)).toContain(i18n.t('documents.message.deleted', { name: 'report.txt' }));
  });

  it('reports a rejected delete and keeps the row', async () => {
    const fileApi = createFileApi();
    fileApi.remove = vi.fn(async () => {
      throw new Error('delete rejected');
    });
    const { container } = renderPage(fileApi);
    await waitFor(() => expect(rows(container)).toHaveLength(1));

    fireEvent.click(rowAction(container, 0, 1));

    await waitFor(() => expect(alert(container)).toContain('delete rejected'));
    expect(rows(container)).toHaveLength(1);
  });

  it('drops the message on an explicit refresh', async () => {
    const fileApi = createFileApi();
    const { container } = renderPage(fileApi);
    await waitFor(() => expect(rows(container)).toHaveLength(1));

    fireEvent.click(rowAction(container, 0, 0));
    await waitFor(() => expect(alert(container)).not.toBeNull());

    fireEvent.click(refreshButton(container));

    await waitFor(() => expect(fileApi.list).toHaveBeenCalledTimes(2));
    expect(alert(container)).toBeNull();
  });

  it('forgets a rejected search and recovers on retry', async () => {
    const fileApi = createFileApi();
    let failed = false;
    fileApi.list = vi.fn(async () => {
      if (!failed) {
        failed = true;
        throw new Error('backend is down');
      }
      return { items: [FILE], total: 1, page: 0, size: 50 };
    });
    const { container } = renderPage(fileApi);

    await waitFor(() => expect(alert(container)).toContain('backend is down'));
    fireEvent.click(refreshButton(container));

    await waitFor(() => expect(rows(container)).toHaveLength(1));
    expect(alert(container)).toBeNull();
  });
});
