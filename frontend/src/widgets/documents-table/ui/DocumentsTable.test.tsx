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

function table(container: HTMLElement): HTMLElement & { loading: boolean } {
  return container.querySelector('ui5-table') as HTMLElement & { loading: boolean };
}

function rows(container: HTMLElement): HTMLElement[] {
  return [...container.querySelectorAll('ui5-table-row')] as HTMLElement[];
}

function cells(row: HTMLElement): (HTMLElement & { textContent: string })[] {
  return [...row.querySelectorAll('ui5-table-cell')] as (HTMLElement & { textContent: string })[];
}

function actions(row: HTMLElement): (HTMLElement & { text: string })[] {
  return [...row.querySelectorAll('ui5-table-row-action')] as (HTMLElement & { text: string })[];
}

beforeEach(() => {
  i18n.setLocale('ru');
});

describe('DocumentsTable', () => {
  it('labels the table and names its columns', () => {
    const { container } = render(<DocumentsTable files={[]} loading={false} onAction={() => undefined} />);

    const table = container.querySelector('ui5-table');
    expect(table?.getAttribute('accessible-name')).toBe(i18n.t('documents.table.label'));
    expect([...container.querySelectorAll('ui5-table-header-cell')].map((cell) => cell.textContent)).toEqual([
      i18n.t('documents.column.name'),
      i18n.t('documents.column.size'),
      i18n.t('documents.column.type'),
      i18n.t('documents.column.owner'),
      i18n.t('documents.column.updated'),
    ]);
  });

  it('shows the busy state of a reload', () => {
    const { container } = render(<DocumentsTable files={[]} loading onAction={() => undefined} />);

    expect(table(container).loading).toBe(true);
  });

  it('renders a row per file with the formatted values', () => {
    const { container } = render(<DocumentsTable files={[FILE]} loading={false} onAction={() => undefined} />);

    const row = rows(container)[0];
    expect(row.getAttribute('row-key')).toBe('file-1');
    expect(row.getAttribute('data-id')).toBe('file-1');
    expect(cells(row).map((cell) => cell.textContent)).toEqual([
      'report.txt',
      formatBytes(FILE.sizeBytes),
      'text/plain',
      'jane@user-kit.local',
      formatDateTime(FILE.updatedAt),
    ]);
  });

  it('renders nothing but the header without files', () => {
    const { container } = render(<DocumentsTable files={[]} loading={false} onAction={() => undefined} />);

    expect(rows(container)).toHaveLength(0);
    expect(container.querySelector('ui5-table')?.getAttribute('no-data-text')).toBe(i18n.t('documents.table.empty'));
  });

  it('reports a download of the clicked row', () => {
    const onAction = vi.fn<(action: DocumentAction, file: FileObjectDto) => void>();
    const { container } = render(<DocumentsTable files={[FILE, OTHER]} loading={false} onAction={onAction} />);

    fireEvent.click(actions(rows(container)[1])[0]);

    expect(onAction).toHaveBeenCalledWith('download', OTHER);
  });

  it('reports a delete of the clicked row', () => {
    const onAction = vi.fn<(action: DocumentAction, file: FileObjectDto) => void>();
    const { container } = render(<DocumentsTable files={[FILE]} loading={false} onAction={onAction} />);

    fireEvent.click(actions(rows(container)[0])[1]);

    expect(onAction).toHaveBeenCalledWith('delete', FILE);
  });

  it('names both row actions', () => {
    const { container } = render(<DocumentsTable files={[FILE]} loading={false} onAction={() => undefined} />);

    expect(actions(rows(container)[0]).map((action) => action.text)).toEqual([
      i18n.t('documents.action.download'),
      i18n.t('documents.action.delete'),
    ]);
  });
});
