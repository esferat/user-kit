import { Table } from '@ui5/webcomponents-react/Table';
import { TableCell } from '@ui5/webcomponents-react/TableCell';
import { TableHeaderCell } from '@ui5/webcomponents-react/TableHeaderCell';
import { TableHeaderRow } from '@ui5/webcomponents-react/TableHeaderRow';
import { TableRow } from '@ui5/webcomponents-react/TableRow';
import { TableRowAction } from '@ui5/webcomponents-react/TableRowAction';

import type { FileObjectDto } from '@/entities/file';

import { useTranslate } from '@/shared/i18n';
import { formatBytes, formatDateTime } from '@/shared/lib';
import { ICONS } from '@/shared/ui';

export type DocumentAction = 'download' | 'delete';

export interface DocumentsTableProps {
  files: readonly FileObjectDto[];
  loading: boolean;
  onAction(action: DocumentAction, file: FileObjectDto): void;
}

const COLUMNS: ReadonlyArray<{ key: string; width: string }> = [
  { key: 'documents.column.name', width: '40%' },
  { key: 'documents.column.size', width: '15%' },
  { key: 'documents.column.type', width: '20%' },
  { key: 'documents.column.owner', width: '15%' },
  { key: 'documents.column.updated', width: '20%' },
];

/** Table of the documents page, including the per row download and delete actions. */
export function DocumentsTable({ files, loading, onAction }: DocumentsTableProps) {
  const t = useTranslate();

  return (
    <Table
      accessibleName={t('documents.table.label')}
      noDataText={t('documents.table.empty')}
      overflowMode="Scroll"
      loading={loading}
    >
      <TableHeaderRow>
        {COLUMNS.map((column) => (
          <TableHeaderCell key={column.key} width={column.width}>
            {t(column.key)}
          </TableHeaderCell>
        ))}
      </TableHeaderRow>
      {files.map((file) => (
        <TableRow key={file.id} rowKey={file.id} data-id={file.id}>
          <TableCell>{file.name}</TableCell>
          <TableCell>{formatBytes(file.sizeBytes)}</TableCell>
          <TableCell>{file.contentType}</TableCell>
          <TableCell>{file.ownerEmail}</TableCell>
          <TableCell>{formatDateTime(file.updatedAt)}</TableCell>
          <TableRowAction
            icon={ICONS.download}
            text={t('documents.action.download')}
            onClick={() => {
              onAction('download', file);
            }}
          />
          <TableRowAction
            icon={ICONS.delete}
            text={t('documents.action.delete')}
            onClick={() => {
              onAction('delete', file);
            }}
          />
        </TableRow>
      ))}
    </Table>
  );
}
