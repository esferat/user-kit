import {
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  TextField,
  Typography,
} from '@mui/material';
import { useEffect, useState } from 'react';

import { useTranslate } from '@/shared/i18n';
import { ICONS } from '@/shared/ui';

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

  useEffect(() => {
    // Успешная загрузка закрывает диалог через его проп `open`, а не через
    // `onClose`, и следующий диалог должен начинаться пустым.
    if (!open) {
      setFiles((current) => (current.length === 0 ? current : []));
      setDescription((current) => (current === '' ? current : ''));
    }
  }, [open]);

  function close(): void {
    setFiles([]);
    setDescription('');
    onClose();
  }

  function submit(): void {
    if (files.length === 0) {
      return;
    }
    const trimmed = description.trim();
    onSubmit(files, trimmed === '' ? undefined : trimmed);
  }

  return (
    <Dialog open={open} onClose={close} maxWidth="sm" fullWidth>
      <DialogTitle>{t('documents.upload.title')}</DialogTitle>
      <DialogContent>
        <div className="upload-dialog-body">
          <TextField
            size="small"
            inputProps={{ 'aria-label': t('documents.upload.description') }}
            placeholder={t('documents.upload.description')}
            value={description}
            onChange={(event) => {
              setDescription(event.target.value);
            }}
          />
          <Button variant="outlined" component="label" startIcon={<ICONS.upload />} className="upload-picker">
            {t('documents.upload.placeholder')}
            <input
              type="file"
              multiple
              hidden
              className="upload-input"
              aria-label={t('documents.upload.placeholder')}
              onChange={(event) => {
                setFiles([...(event.target.files ?? [])]);
              }}
            />
          </Button>
          {files.length > 0 && (
            <Box className="upload-list" component="ul" sx={{ m: 0, pl: '1.25rem' }}>
              {files.map((file) => (
                <Typography key={file.name} component="li" variant="body2">
                  {file.name}
                </Typography>
              ))}
            </Box>
          )}
        </div>
      </DialogContent>
      <DialogActions>
        <Button onClick={close}>{t('common.cancel')}</Button>
        <Button
          variant="contained"
          disabled={submitting || files.length === 0}
          startIcon={submitting ? <CircularProgress className="submit-spin" size={16} color="inherit" /> : undefined}
          onClick={submit}
        >
          {t('documents.upload')}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
