import { Button, Space, Table } from 'antd';
import { useMemo } from 'react';

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

/** Таблица страницы документов, включая действия скачивания и удаления для каждой строки. */
export function DocumentsTable({ files, loading, onAction }: DocumentsTableProps) {
  const t = useTranslate();

  const columns = useMemo(
    () => [
      {
        title: t('documents.column.name'),
        dataIndex: 'name',
        key: 'name',
      },
      {
        title: t('documents.column.size'),
        key: 'size',
        width: 120,
        render: (_value: unknown, file: FileObjectDto) => formatBytes(file.sizeBytes),
      },
      {
        title: t('documents.column.type'),
        key: 'contentType',
        render: (_value: unknown, file: FileObjectDto) => file.contentType,
      },
      {
        title: t('documents.column.owner'),
        key: 'owner',
        render: (_value: unknown, file: FileObjectDto) => file.ownerEmail,
      },
      {
        title: t('documents.column.updated'),
        key: 'updated',
        render: (_value: unknown, file: FileObjectDto) => formatDateTime(file.updatedAt),
      },
      {
        title: '',
        key: 'actions',
        width: 96,
        render: (_value: unknown, file: FileObjectDto) => (
          <Space size="small">
            <Button
              aria-label={t('documents.action.download')}
              title={t('documents.action.download')}
              icon={<ICONS.download />}
              onClick={() => {
                onAction('download', file);
              }}
            />
            <Button
              danger
              aria-label={t('documents.action.delete')}
              title={t('documents.action.delete')}
              icon={<ICONS.delete />}
              onClick={() => {
                onAction('delete', file);
              }}
            />
          </Space>
        ),
      },
    ],
    [t, onAction],
  );

  return (
    <Table<FileObjectDto>
      aria-label={t('documents.table.label')}
      rowKey="id"
      columns={columns}
      dataSource={[...files]}
      loading={loading}
      pagination={false}
      scroll={{ x: 'max-content' }}
      locale={{ emptyText: t('documents.table.empty') }}
    />
  );
}
