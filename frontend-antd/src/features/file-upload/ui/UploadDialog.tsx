import { Button, Input, Modal, Upload } from 'antd';
import { useCallback, useEffect, useState } from 'react';

import type { UploadFile } from 'antd';

import { useTranslate } from '@/shared/i18n';

export type UploadSubmit = (files: readonly File[], description: string | undefined) => void;

export interface UploadDialogProps {
  open: boolean;
  /** Показывает прогресс загрузки и блокирует кнопку подтверждения. */
  submitting: boolean;
  onClose(): void;
  onSubmit: UploadSubmit;
}

/** Диалог, который собирает файлы и необязательное описание загрузки. */
export function UploadDialog({ open, submitting, onClose, onSubmit }: UploadDialogProps) {
  const t = useTranslate();
  const [fileList, setFileList] = useState<readonly UploadFile[]>([]);
  const [description, setDescription] = useState('');

  const reset = useCallback((): void => {
    // Идентичность нетронутого значения сохраняется, поэтому закрытие уже
    // закрытого диалога не запускает отрисовку.
    setFileList((current) => (current.length === 0 ? current : []));
    setDescription((current) => (current === '' ? current : ''));
  }, []);

  useEffect(() => {
    // Успешная загрузка закрывает диалог через его проп `open`, а не через
    // `onClose`, и следующий диалог должен начинаться пустым.
    if (!open) {
      reset();
    }
  }, [open, reset]);

  function close(): void {
    reset();
    onClose();
  }

  return (
    <Modal
      title={t('documents.upload.title')}
      open={open}
      destroyOnHidden
      onCancel={close}
      footer={[
        <Button key="cancel" onClick={close}>
          {t('common.cancel')}
        </Button>,
        <Button
          key="submit"
          type="primary"
          loading={submitting}
          disabled={submitting || fileList.length === 0}
          onClick={() => {
            const files = fileList.flatMap((entry) => (entry.originFileObj === undefined ? [] : [entry.originFileObj]));
            if (files.length === 0) {
              return;
            }
            const trimmed = description.trim();
            onSubmit(files, trimmed === '' ? undefined : trimmed);
          }}
        >
          {t('documents.upload')}
        </Button>,
      ]}
    >
      <div className="upload-dialog-body">
        <Input
          aria-label={t('documents.upload.description')}
          placeholder={t('documents.upload.description')}
          value={description}
          onChange={(event) => {
            setDescription(event.target.value);
          }}
        />
        <Upload
          aria-label={t('documents.upload.placeholder')}
          multiple
          fileList={[...fileList]}
          beforeUpload={() => false}
          onChange={({ fileList: next }) => {
            setFileList(next);
          }}
        >
          <Button>{t('documents.upload.placeholder')}</Button>
        </Upload>
      </div>
    </Modal>
  );
}
