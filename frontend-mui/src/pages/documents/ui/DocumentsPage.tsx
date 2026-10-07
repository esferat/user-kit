import { Button, CircularProgress, IconButton, MenuItem, TextField, Tooltip } from '@mui/material';
import { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';

import {
  FILES_SORTS,
  selectDocuments,
  sortDocuments,
  refreshDocuments,
  searchDocuments,
  uploadDocuments,
  removeDocument,
  downloadDocument,
  openUpload,
  closeUpload,
  type FilesSort,
} from '../model/documentsSlice';

import type { FileObjectDto } from '@/entities/file';
import type { AppDispatch } from '@/shared/lib';

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

/** Страница документов: поиск, сортировка, загрузка и таблица сохранённых файлов. */
export function DocumentsPage() {
  const t = useTranslate();
  const dispatch = useDispatch<AppDispatch>();
  const state = useSelector(selectDocuments);

  useEffect(() => {
    void dispatch(refreshDocuments());
  }, [dispatch]);

  function onAction(action: 'download' | 'delete', file: FileObjectDto): void {
    void dispatch(action === 'download' ? downloadDocument(file) : removeDocument(file));
  }

  return (
    <>
      <div className="page">
        <div className="page-header">
          <h1 className="page-title">{t('documents.title')}</h1>
          <div className="page-toolbar">
            <div className="page-toolbar-fields">
              <TextField
                size="small"
                inputProps={{ 'aria-label': t('documents.search') }}
                placeholder={t('documents.search')}
                value={state.search}
                onChange={(event) => {
                  void dispatch(searchDocuments(event.target.value));
                }}
              />
              <TextField
                select
                size="small"
                inputProps={{ 'aria-label': t('documents.sort.label') }}
                value={state.sort}
                onChange={(event) => {
                  void dispatch(sortDocuments(event.target.value as FilesSort));
                }}
                sx={{ minWidth: '12rem' }}
              >
                {FILES_SORTS.map((sort) => (
                  <MenuItem key={sort} value={sort}>
                    {t(SORT_LABEL_KEYS[sort])}
                  </MenuItem>
                ))}
              </TextField>
            </div>
            <div className="page-toolbar-actions">
              <Tooltip title={t('documents.refresh')}>
                <IconButton
                  aria-label={t('documents.refresh')}
                  onClick={() => {
                    void dispatch(refreshDocuments());
                  }}
                >
                  {state.loading ? <CircularProgress className="refresh-spin" size={20} /> : <ICONS.refresh />}
                </IconButton>
              </Tooltip>
              <Button
                variant="contained"
                startIcon={<ICONS.upload />}
                onClick={() => {
                  dispatch(openUpload());
                }}
              >
                {t('documents.upload')}
              </Button>
            </div>
          </div>
        </div>
        <div className="page-content">
          <div className="message-host">
            {state.message !== undefined && <Message text={state.message.text} design={state.message.design} />}
          </div>
          <DocumentsTable files={state.files} loading={state.loading} onAction={onAction} />
        </div>
      </div>
      <UploadDialog
        open={state.uploadOpen}
        submitting={state.submitting}
        onClose={() => {
          dispatch(closeUpload());
        }}
        onSubmit={(files, description) => {
          void dispatch(uploadDocuments({ files, description }));
        }}
      />
    </>
  );
}
