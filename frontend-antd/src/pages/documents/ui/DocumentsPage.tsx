import { Button, Input, Select, Space } from 'antd';
import { observer } from 'mobx-react-lite';
import { useEffect } from 'react';

import { FILES_SORTS } from '../model/filesStore';

import type { FilesSort, FilesStore } from '../model/filesStore';

import type { FileObjectDto } from '@/entities/file';

import { UploadDialog } from '@/features/file-upload';
import { useTranslate } from '@/shared/i18n';
import { ICONS, Message } from '@/shared/ui';
import { DocumentsTable } from '@/widgets/documents-table';

const SORT_LABEL_KEYS: Record<FilesSort, string> = {
  'createdAt-desc': 'documents.sort.newest',
  'createdAt-asc': 'documents.sort.oldest',
  'name-asc': 'documents.sort.name',
  'sizeBytes-desc': 'documents.sort.sizeDesc',
};

export interface DocumentsPageProps {
  store: FilesStore;
}

function DocumentsPageView({ store }: DocumentsPageProps) {
  const t = useTranslate();

  useEffect(() => store.start(), [store]);

  function onAction(action: 'download' | 'delete', file: FileObjectDto): void {
    void (action === 'download' ? store.download(file) : store.remove(file));
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
                value={store.search}
                onChange={(event) => {
                  store.setSearch(event.target.value);
                }}
              />
              <Select<FilesSort>
                aria-label={t('documents.sort.label')}
                value={store.sort}
                options={FILES_SORTS.map((sort) => ({ label: t(SORT_LABEL_KEYS[sort]), value: sort }))}
                onChange={(selected) => {
                  store.setSort(selected);
                }}
              />
            </Space>
            <Space>
              <Button
                aria-label={t('documents.refresh')}
                title={t('documents.refresh')}
                icon={<ICONS.refresh />}
                loading={store.loading}
                onClick={() => {
                  void store.refresh();
                }}
              />
              <Button type="primary" icon={<ICONS.upload />} onClick={() => store.openUpload()}>
                {t('documents.upload')}
              </Button>
            </Space>
          </div>
        </div>
        <div className="page-content">
          <div className="message-host">
            {store.message !== undefined && <Message text={store.message.text} design={store.message.design} />}
          </div>
          <DocumentsTable files={store.files} loading={store.loading} onAction={onAction} />
        </div>
      </div>
      <UploadDialog
        open={store.uploadOpen}
        submitting={store.submitting}
        onClose={() => {
          store.closeUpload();
        }}
        onSubmit={(files, description) => {
          void store.upload(files, description);
        }}
      />
    </>
  );
}

/** Страница документов: поиск, сортировка, загрузка и таблица сохранённых файлов. */
export const DocumentsPage = observer(DocumentsPageView);
