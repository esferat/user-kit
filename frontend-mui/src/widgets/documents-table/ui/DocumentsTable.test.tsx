import { fireEvent, render } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { DocumentsTable } from './DocumentsTable';

import type { DocumentAction } from './DocumentsTable';

import type { FileObjectDto } from '@/entities/file';

import { i18n } from '@/shared/i18n';
import { formatBytes, formatDateTime } from '@/shared/lib';

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

const OTHER: FileObjectDto = {
  ...FILE,
  id: 'file-2',
  name: 'invoice.pdf',
  sizeBytes: 10,
  ownerEmail: 'bob@user-kit.local',
};

function table(container: HTMLElement): HTMLTableElement {
  return container.querySelector('table') as HTMLTableElement;
}

function headerCells(container: HTMLElement): string[] {
  return [...container.querySelectorAll('thead th')].map((cell) => cell.textContent ?? '');
}

function rows(container: HTMLElement): HTMLElement[] {
  return [...container.querySelectorAll('tbody tr.table-row')] as HTMLElement[];
}

function cells(row: HTMLElement): string[] {
  return [...row.querySelectorAll('td')].map((cell) => cell.textContent ?? '');
}

/** В строке находятся кнопки действий в последнем столбце. */
function actionButtons(row: HTMLElement): HTMLButtonElement[] {
  return [...row.querySelectorAll('td:last-child button')] as HTMLButtonElement[];
}

function isLoading(container: HTMLElement): boolean {
  return container.querySelector('.table-loading') !== null;
}

beforeEach(() => {
  i18n.setLocale('ru');
});

describe('DocumentsTable', () => {
  it('labels the table and names its columns', () => {
    const { container } = render(<DocumentsTable files={[]} loading={false} onAction={() => undefined} />);

    expect(table(container).getAttribute('aria-label')).toBe(i18n.t('documents.table.label'));
    expect(headerCells(container)).toEqual([
      i18n.t('documents.column.name'),
      i18n.t('documents.column.size'),
      i18n.t('documents.column.type'),
      i18n.t('documents.column.owner'),
      i18n.t('documents.column.updated'),
      '',
    ]);
  });

  it('shows the busy state of a reload', () => {
    const { container } = render(<DocumentsTable files={[]} loading onAction={() => undefined} />);

    expect(isLoading(container)).toBe(true);
  });

  it('renders a row per file with the formatted values', () => {
    const { container } = render(<DocumentsTable files={[FILE]} loading={false} onAction={() => undefined} />);

    expect(rows(container)).toHaveLength(1);
    expect(cells(rows(container)[0]).slice(0, 5)).toEqual([
      'report.txt',
      formatBytes(FILE.sizeBytes),
      'text/plain',
      'jane@user-kit.local',
      formatDateTime(FILE.updatedAt),
    ]);
  });

  it('renders the empty text without files', () => {
    const { container } = render(<DocumentsTable files={[]} loading={false} onAction={() => undefined} />);

    expect(rows(container)).toHaveLength(0);
    expect(table(container).textContent).toContain(i18n.t('documents.table.empty'));
  });

  it('reports a download of the clicked row', () => {
    const onAction = vi.fn<(action: DocumentAction, file: FileObjectDto) => void>();
    const { container } = render(<DocumentsTable files={[FILE, OTHER]} loading={false} onAction={onAction} />);

    fireEvent.click(actionButtons(rows(container)[1])[0]);

    expect(onAction).toHaveBeenCalledWith('download', OTHER);
  });

  it('reports a delete of the clicked row', () => {
    const onAction = vi.fn<(action: DocumentAction, file: FileObjectDto) => void>();
    const { container } = render(<DocumentsTable files={[FILE]} loading={false} onAction={onAction} />);

    fireEvent.click(actionButtons(rows(container)[0])[1]);

    expect(onAction).toHaveBeenCalledWith('delete', FILE);
  });

  it('names both row actions', () => {
    const { container } = render(<DocumentsTable files={[FILE]} loading={false} onAction={() => undefined} />);

    expect(actionButtons(rows(container)[0]).map((button) => button.getAttribute('aria-label'))).toEqual([
      i18n.t('documents.action.download'),
      i18n.t('documents.action.delete'),
    ]);
  });
});
