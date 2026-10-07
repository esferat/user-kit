import {
  Box,
  IconButton,
  LinearProgress,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tooltip,
  Typography,
} from '@mui/material';

import type { ReactNode } from 'react';

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

function TooltipButton({
  label,
  color,
  icon,
  onClick,
}: {
  label: string;
  color?: 'inherit' | 'error';
  icon: ReactNode;
  onClick: () => void;
}) {
  return (
    <Tooltip title={label}>
      <IconButton aria-label={label} color={color} onClick={onClick}>
        {icon}
      </IconButton>
    </Tooltip>
  );
}

/** Таблица страницы документов, включая действия скачивания и удаления для каждой строки. */
export function DocumentsTable({ files, loading, onAction }: DocumentsTableProps) {
  const t = useTranslate();

  return (
    <Box sx={{ position: 'relative' }}>
      <TableContainer>
        <Table aria-label={t('documents.table.label')} sx={{ minWidth: 'max-content' }} size="small">
          <TableHead>
            <TableRow>
              <TableCell>{t('documents.column.name')}</TableCell>
              <TableCell sx={{ width: '7.5rem' }}>{t('documents.column.size')}</TableCell>
              <TableCell>{t('documents.column.type')}</TableCell>
              <TableCell>{t('documents.column.owner')}</TableCell>
              <TableCell>{t('documents.column.updated')}</TableCell>
              <TableCell align="right" sx={{ width: '6rem' }} />
            </TableRow>
          </TableHead>
          <TableBody>
            {files.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} align="center">
                  <Typography color="text.secondary">{t('documents.table.empty')}</Typography>
                </TableCell>
              </TableRow>
            ) : (
              files.map((file) => (
                <TableRow key={file.id} hover className="table-row">
                  <TableCell>{file.name}</TableCell>
                  <TableCell>{formatBytes(file.sizeBytes)}</TableCell>
                  <TableCell>{file.contentType}</TableCell>
                  <TableCell>{file.ownerEmail}</TableCell>
                  <TableCell>{formatDateTime(file.updatedAt)}</TableCell>
                  <TableCell align="right" className="row-actions">
                    <TooltipButton
                      label={t('documents.action.download')}
                      icon={<ICONS.download fontSize="small" />}
                      onClick={() => {
                        onAction('download', file);
                      }}
                    />
                    <TooltipButton
                      label={t('documents.action.delete')}
                      color="error"
                      icon={<ICONS.delete fontSize="small" />}
                      onClick={() => {
                        onAction('delete', file);
                      }}
                    />
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>
      {loading && <LinearProgress className="table-loading" sx={{ position: 'absolute', top: 0, left: 0, right: 0 }} />}
    </Box>
  );
}
