import { Input } from '@ui5/webcomponents-react/Input';
import { Page } from '@ui5/webcomponents-react/Page';
import { Title } from '@ui5/webcomponents-react/Title';
import { Toolbar } from '@ui5/webcomponents-react/Toolbar';
import { ToolbarButton } from '@ui5/webcomponents-react/ToolbarButton';
import { ToolbarItem } from '@ui5/webcomponents-react/ToolbarItem';
import { ToolbarSelect } from '@ui5/webcomponents-react/ToolbarSelect';
import { ToolbarSelectOption } from '@ui5/webcomponents-react/ToolbarSelectOption';
import { ToolbarSpacer } from '@ui5/webcomponents-react/ToolbarSpacer';
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
      <Page>
        <header className="page-header" slot="header">
          <Title>{t('documents.title')}</Title>
          <Toolbar>
            <ToolbarItem>
              <Input
                accessibleName={t('documents.search')}
                placeholder={t('documents.search')}
                showClearIcon
                value={store.search}
                onInput={(event) => {
                  store.setSearch(event.target.value);
                }}
              />
            </ToolbarItem>
            <ToolbarSelect
              accessibleName={t('documents.sort.label')}
              value={store.sort}
              onChange={(event) => {
                store.setSort(event.detail.selectedOption.value as FilesSort);
              }}
            >
              {FILES_SORTS.map((sort) => (
                <ToolbarSelectOption key={sort} value={sort}>
                  {t(SORT_LABEL_KEYS[sort])}
                </ToolbarSelectOption>
              ))}
            </ToolbarSelect>
            <ToolbarSpacer />
            <ToolbarButton
              icon={ICONS.refresh}
              tooltip={t('documents.refresh')}
              accessibleName={t('documents.refresh')}
              onClick={() => {
                void store.refresh();
              }}
            />
            <ToolbarButton
              design="Emphasized"
              icon={ICONS.upload}
              text={t('documents.upload')}
              onClick={() => {
                store.openUpload();
              }}
            />
          </Toolbar>
        </header>
        <div className="page-content">
          <div className="message-host">
            {store.message !== undefined && <Message text={store.message.text} design={store.message.design} />}
          </div>
          <DocumentsTable files={store.files} loading={store.loading} onAction={onAction} />
        </div>
      </Page>
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

/** Documents page: search, sorting, upload and the table of the stored files. */
export const DocumentsPage = observer(DocumentsPageView);
