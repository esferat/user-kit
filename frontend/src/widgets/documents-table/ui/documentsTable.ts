import '@ui5/webcomponents/dist/Table.js';
import '@ui5/webcomponents/dist/TableCell.js';
import '@ui5/webcomponents/dist/TableHeaderCell.js';
import '@ui5/webcomponents/dist/TableHeaderRow.js';
import '@ui5/webcomponents/dist/TableRow.js';
import '@ui5/webcomponents/dist/TableRowAction.js';

import type Table from '@ui5/webcomponents/dist/Table.js';
import type TableRow from '@ui5/webcomponents/dist/TableRow.js';
import type TableRowAction from '@ui5/webcomponents/dist/TableRowAction.js';

import type { FileObjectDto } from '@/entities/file';

import { t } from '@/shared/i18n';
import { detailOf, element, formatBytes, formatDateTime } from '@/shared/lib';
import { ICONS } from '@/shared/ui';

export type DocumentAction = 'download' | 'delete';

export interface DocumentsTableOptions {
  onAction(action: DocumentAction, file: FileObjectDto): void;
}

export interface DocumentsTable {
  readonly element: HTMLElement;
  setLoading(loading: boolean): void;
  setFiles(files: readonly FileObjectDto[]): void;
}

const COLUMNS: ReadonlyArray<{ key: string; width: string }> = [
  { key: 'documents.column.name', width: '40%' },
  { key: 'documents.column.size', width: '15%' },
  { key: 'documents.column.type', width: '20%' },
  { key: 'documents.column.owner', width: '15%' },
  { key: 'documents.column.updated', width: '20%' },
];

/** Table of the documents page, including the per row download and delete actions. */
export function createDocumentsTable(options: DocumentsTableOptions): DocumentsTable {
  const table = document.createElement('ui5-table') as Table;
  table.accessibleName = t('documents.table.label');
  table.noDataText = t('documents.table.empty');
  table.overflowMode = 'Scroll';

  const headerRow = document.createElement('ui5-table-header-row');
  COLUMNS.forEach((column) => {
    const cell = element('ui5-table-header-cell', { text: t(column.key) });
    cell.setAttribute('width', column.width);
    headerRow.appendChild(cell);
  });
  table.appendChild(headerRow);

  const files = new Map<string, FileObjectDto>();
  const handlers = new Map<TableRowAction, (file: FileObjectDto) => void>();

  function buildRow(file: FileObjectDto): TableRow {
    const row = document.createElement('ui5-table-row') as TableRow;
    row.rowKey = file.id;
    row.setAttribute('data-id', file.id);

    [file.name, formatBytes(file.sizeBytes), file.contentType, file.ownerEmail, formatDateTime(file.updatedAt)].forEach(
      (value) => {
        row.appendChild(element('ui5-table-cell', { text: value }));
      },
    );

    const downloadAction = document.createElement('ui5-table-row-action') as TableRowAction;
    downloadAction.icon = ICONS.download;
    downloadAction.text = t('documents.action.download');
    row.appendChild(downloadAction);
    handlers.set(downloadAction, (target) => {
      options.onAction('download', target);
    });

    const deleteAction = document.createElement('ui5-table-row-action') as TableRowAction;
    deleteAction.icon = ICONS.delete;
    deleteAction.text = t('documents.action.delete');
    row.appendChild(deleteAction);
    handlers.set(deleteAction, (target) => {
      options.onAction('delete', target);
    });

    return row;
  }

  table.addEventListener('row-action-click', (event) => {
    const { action, row } = detailOf<{ action: TableRowAction; row: TableRow }>(event);
    const fileId = row.getAttribute('data-id');
    if (fileId === null) {
      return;
    }
    const file = files.get(fileId);
    const handler = handlers.get(action);
    if (file !== undefined && handler !== undefined) {
      handler(file);
    }
  });

  return {
    element: table,
    setLoading(loading: boolean): void {
      table.loading = loading;
    },
    setFiles(next: readonly FileObjectDto[]): void {
      files.clear();
      handlers.clear();
      next.forEach((file) => files.set(file.id, file));

      table.querySelectorAll('ui5-table-row').forEach((row) => row.remove());
      next.forEach((file) => table.appendChild(buildRow(file)));
      table.noDataText = t('documents.table.empty');
    },
  };
}
