import { Button, Input, Select, Space } from 'antd';
import { useEffect, useState } from 'react';

import type { FileApi, FileObjectDto } from '@/entities/file';
import type { FilterNode, OrderByItem } from '@/shared/api';

import { downloadBlob } from '@/features/file-download';
import { UploadDialog } from '@/features/file-upload';
import { useTranslate } from '@/shared/i18n';
import { messageOfError, useAsyncTask, type AppMessage } from '@/shared/lib';
import { ICONS, Message } from '@/shared/ui';
import { DocumentsTable } from '@/widgets/documents-table';

type SortKey = 'createdAt-desc' | 'createdAt-asc' | 'name-asc' | 'sizeBytes-desc';

const SORT_OPTIONS: ReadonlyArray<{ value: SortKey; key: string }> = [
  { value: 'createdAt-desc', key: 'documents.sort.newest' },
  { value: 'createdAt-asc', key: 'documents.sort.oldest' },
  { value: 'name-asc', key: 'documents.sort.name' },
  { value: 'sizeBytes-desc', key: 'documents.sort.sizeDesc' },
];

const SORT_TO_ORDER_BY: Record<SortKey, OrderByItem[]> = {
  'createdAt-desc': [{ property: 'createdAt', descending: true }],
  'createdAt-asc': [{ property: 'createdAt' }],
  'name-asc': [{ property: 'name' }],
  'sizeBytes-desc': [{ property: 'sizeBytes', descending: true }],
};

export interface DocumentsPageProps {
  fileApi: FileApi;
}

/** Documents page: search, sorting, upload and the table of the stored files. */
export function DocumentsPage({ fileApi }: DocumentsPageProps) {
  const t = useTranslate();
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<SortKey>('createdAt-desc');
  const [message, setMessage] = useState<AppMessage | undefined>(undefined);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const list = useAsyncTask(() => {
    const term = search.trim();
    const filter: FilterNode | undefined =
      term === '' ? undefined : { kind: 'function', name: 'contains', property: 'name', value: term };

    return fileApi.list({ filter, orderBy: SORT_TO_ORDER_BY[sort], top: 50, count: true });
  });
  const { data, error, loading, run } = list;

  useEffect(() => {
    void run();
  }, [run, search, sort]);

  useEffect(() => {
    if (error !== undefined) {
      setMessage({ text: messageOfError(error, t('common.unknownError')), design: 'Error' });
    }
  }, [error, t]);

  async function download(file: FileObjectDto): Promise<void> {
    try {
      const blob = await fileApi.downloadContent(file.id);
      downloadBlob(blob, file.name);
      setMessage({ text: t('documents.message.downloaded', { name: file.name }), design: 'Success' });
    } catch (reason) {
      setMessage({ text: messageOfError(reason, t('common.unknownError')), design: 'Error' });
    }
  }

  async function remove(file: FileObjectDto): Promise<void> {
    try {
      await fileApi.remove(file.id, file.etag);
      setMessage({ text: t('documents.message.deleted', { name: file.name }), design: 'Success' });
      await run();
    } catch (reason) {
      setMessage({ text: messageOfError(reason, t('common.unknownError')), design: 'Error' });
    }
  }

  async function upload(files: readonly File[], description: string | undefined): Promise<void> {
    setSubmitting(true);
    try {
      for (const file of files) {
        await fileApi.upload(file, description);
      }
      setUploadOpen(false);
      setMessage({ text: t('documents.message.uploaded', { count: files.length }), design: 'Success' });
      await run();
    } catch (reason) {
      setMessage({ text: messageOfError(reason, t('common.unknownError')), design: 'Error' });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <div className="page">
        <div className="page-header">
          <h1 className="page-title">{t('documents.title')}</h1>
          <div className="page-toolbar">
            <Space wrap>
              <Input
                aria-label={t('documents.search')}
                placeholder={t('documents.search')}
                allowClear
                value={search}
                onChange={(event) => {
                  setMessage(undefined);
                  setSearch(event.target.value);
                }}
              />
              <Select<SortKey>
                aria-label={t('documents.sort.label')}
                value={sort}
                options={SORT_OPTIONS.map((option) => ({ label: t(option.key), value: option.value }))}
                onChange={(selected) => {
                  if (selected !== sort) {
                    setMessage(undefined);
                    setSort(selected);
                  }
                }}
              />
            </Space>
            <Space>
              <Button
                aria-label={t('documents.refresh')}
                title={t('documents.refresh')}
                icon={<ICONS.refresh />}
                loading={loading}
                onClick={() => {
                  setMessage(undefined);
                  void run();
                }}
              />
              <Button
                type="primary"
                icon={<ICONS.upload />}
                onClick={() => {
                  setUploadOpen(true);
                }}
              >
                {t('documents.upload')}
              </Button>
            </Space>
          </div>
        </div>
        <div className="page-content">
          <div className="message-host">
            {message !== undefined && <Message text={message.text} design={message.design} />}
          </div>
          <DocumentsTable
            files={data?.value ?? []}
            loading={loading}
            onAction={(action, file) => {
              void (action === 'download' ? download(file) : remove(file));
            }}
          />
        </div>
      </div>
      <UploadDialog
        open={uploadOpen}
        submitting={submitting}
        onClose={() => {
          setUploadOpen(false);
        }}
        onSubmit={(files, description) => {
          void upload(files, description);
        }}
      />
    </>
  );
}
