import '@ui5/webcomponents-icons/dist/AllIcons.js';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { FileObjectDto } from '@/entities/file';

import { createDocumentsTable, type DocumentAction } from './documentsTable';

import { i18n } from '@/shared/i18n';
import { formatBytes, formatDateTime } from '@/shared/lib';

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
  {
    id: 'f-2',
    name: 'report.pdf',
    description: null,
    contentType: 'application/pdf',
    sizeBytes: 1024 * 1024,
    ownerId: 'u-2',
    ownerEmail: 'root@user-kit.local',
    createdAt: '2026-01-02T11:00:00Z',
    updatedAt: '2026-01-04T11:00:00Z',
  },
];

function rowActions(row: Element): Element[] {
  return [...row.querySelectorAll('ui5-table-row-action')];
}

function cells(row: Element): string[] {
  return [...row.querySelectorAll('ui5-table-cell')].map((cell) => cell.textContent ?? '');
}

function clickAction(table: Element, row: Element, action: Element): void {
  table.dispatchEvent(
    new CustomEvent('row-action-click', { detail: { action, row }, bubbles: true }),
  );
}

describe('createDocumentsTable', () => {
  beforeEach(() => {
    i18n.setLocale('ru');
  });

  it('renders the translated header cells', () => {
    const table = createDocumentsTable({ onAction: vi.fn() });

    const headers = [...table.element.querySelectorAll('ui5-table-header-cell')];
    expect(headers.map((header) => header.textContent)).toEqual([
      i18n.t('documents.column.name'),
      i18n.t('documents.column.size'),
      i18n.t('documents.column.type'),
      i18n.t('documents.column.owner'),
      i18n.t('documents.column.updated'),
    ]);
    expect((table.element as unknown as { accessibleName: string }).accessibleName).toBe(
      i18n.t('documents.table.label'),
    );
  });

  it('renders one row per file with the formatted columns', () => {
    const table = createDocumentsTable({ onAction: vi.fn() });

    table.setFiles(files);

    const rows = [...table.element.querySelectorAll('ui5-table-row')];
    expect(rows).toHaveLength(2);
    expect(rows[0].getAttribute('data-id')).toBe('f-1');
    expect(cells(rows[0])).toEqual([
      'hello.txt',
      formatBytes(2048),
      'text/plain',
      'jane@user-kit.local',
      formatDateTime(files[0].updatedAt),
    ]);
  });

  it('replaces the rows on every update', () => {
    const table = createDocumentsTable({ onAction: vi.fn() });

    table.setFiles(files);
    table.setFiles([files[1]]);

    expect(table.element.querySelectorAll('ui5-table-row')).toHaveLength(1);
    expect(table.element.querySelectorAll('ui5-table-row')[0].getAttribute('data-id')).toBe('f-2');
  });

  it('reports the download and the delete action of the clicked row', () => {
    const onAction = vi.fn<(action: DocumentAction, file: FileObjectDto) => void>();
    const table = createDocumentsTable({ onAction });
    table.setFiles(files);

    const [firstRow, secondRow] = [...table.element.querySelectorAll('ui5-table-row')];
    const [download, remove] = rowActions(firstRow);

    clickAction(table.element, firstRow, download);
    clickAction(table.element, secondRow, remove);

    expect(onAction).toHaveBeenNthCalledWith(1, 'download', files[0]);
    expect(onAction).toHaveBeenNthCalledWith(2, 'delete', files[1]);
  });

  it('ignores an action of a row that is no longer known', () => {
    const onAction = vi.fn();
    const table = createDocumentsTable({ onAction });
    table.setFiles(files);

    const row = table.element.querySelectorAll('ui5-table-row')[0];
    const [download] = rowActions(row);
    table.setFiles([]);

    clickAction(table.element, row, download);

    expect(onAction).not.toHaveBeenCalled();
  });

  it('ignores an action of a row without a file id', () => {
    const onAction = vi.fn();
    const table = createDocumentsTable({ onAction });
    const row = document.createElement('ui5-table-row');
    table.element.appendChild(row);
    const action = document.createElement('ui5-table-row-action');
    row.appendChild(action);

    clickAction(table.element, row, action);

    expect(onAction).not.toHaveBeenCalled();
  });

  it('shows the loading state of the table', () => {
    const table = createDocumentsTable({ onAction: vi.fn() });

    table.setLoading(true);
    expect((table.element as unknown as { loading: boolean }).loading).toBe(true);

    table.setLoading(false);
    expect((table.element as unknown as { loading: boolean }).loading).toBe(false);
  });

  it('announces an empty table', () => {
    const table = createDocumentsTable({ onAction: vi.fn() });

    table.setFiles([]);

    expect((table.element as unknown as { noDataText: string }).noDataText).toBe(
      i18n.t('documents.table.empty'),
    );
    expect(table.element.querySelectorAll('ui5-table-row')).toHaveLength(0);
  });
});
