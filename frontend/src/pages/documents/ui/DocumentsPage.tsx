import { Input } from '@ui5/webcomponents-react/Input';
import { Page } from '@ui5/webcomponents-react/Page';
import { Title } from '@ui5/webcomponents-react/Title';
import { Toolbar } from '@ui5/webcomponents-react/Toolbar';
import { ToolbarButton } from '@ui5/webcomponents-react/ToolbarButton';
import { ToolbarItem } from '@ui5/webcomponents-react/ToolbarItem';
import { ToolbarSelect } from '@ui5/webcomponents-react/ToolbarSelect';
import { ToolbarSelectOption } from '@ui5/webcomponents-react/ToolbarSelectOption';
import { ToolbarSpacer } from '@ui5/webcomponents-react/ToolbarSpacer';
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
      <Page>
        <header className="page-header" slot="header">
          <Title>{t('documents.title')}</Title>
          <Toolbar>
            <ToolbarItem>
              <Input
                accessibleName={t('documents.search')}
                placeholder={t('documents.search')}
                showClearIcon
                value={search}
                onInput={(event) => {
                  setMessage(undefined);
                  setSearch(event.target.value);
                }}
              />
            </ToolbarItem>
            <ToolbarSelect
              accessibleName={t('documents.sort.label')}
              value={sort}
              onChange={(event) => {
                const selected = event.detail.selectedOption.value as SortKey;
                if (selected !== sort) {
                  setMessage(undefined);
                  setSort(selected);
                }
              }}
            >
              {SORT_OPTIONS.map((option) => (
                <ToolbarSelectOption key={option.value} value={option.value}>
                  {t(option.key)}
                </ToolbarSelectOption>
              ))}
            </ToolbarSelect>
            <ToolbarSpacer />
            <ToolbarButton
              icon={ICONS.refresh}
              tooltip={t('documents.refresh')}
              accessibleName={t('documents.refresh')}
              onClick={() => {
                setMessage(undefined);
                void run();
              }}
            />
            <ToolbarButton
              design="Emphasized"
              icon={ICONS.upload}
              text={t('documents.upload')}
              onClick={() => {
                setUploadOpen(true);
              }}
            />
          </Toolbar>
        </header>
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
      </Page>
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
