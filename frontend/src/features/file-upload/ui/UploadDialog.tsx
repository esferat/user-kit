import { Button } from '@ui5/webcomponents-react/Button';
import { Dialog } from '@ui5/webcomponents-react/Dialog';
import { FileUploader } from '@ui5/webcomponents-react/FileUploader';
import { Input } from '@ui5/webcomponents-react/Input';
import { useCallback, useEffect, useState } from 'react';

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
  const [files, setFiles] = useState<readonly File[]>([]);
  const [description, setDescription] = useState('');

  const reset = useCallback((): void => {
    // Идентичность нетронутого значения сохраняется, поэтому закрытие уже
    // закрытого диалога не запускает отрисовку.
    setFiles((current) => (current.length === 0 ? current : []));
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
    <Dialog headerText={t('documents.upload.title')} open={open} onClose={close}>
      <Input
        placeholder={t('documents.upload.description')}
        value={description}
        onChange={(event) => {
          setDescription(event.target.value);
        }}
      />
      <FileUploader
        placeholder={t('documents.upload.placeholder')}
        onChange={(event) => {
          setFiles([...((event.target.files ?? []) as FileList)]);
        }}
      />
      <div slot="footer">
        <div className="dialog-footer">
          <Button onClick={close}>{t('common.cancel')}</Button>
          <Button
            design="Emphasized"
            disabled={submitting || files.length === 0}
            loading={submitting}
            onClick={() => {
              if (files.length === 0) {
                return;
              }
              const trimmed = description.trim();
              onSubmit(files, trimmed === '' ? undefined : trimmed);
            }}
          >
            {t('documents.upload')}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
