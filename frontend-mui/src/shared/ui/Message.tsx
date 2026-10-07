import { Alert, type AlertColor } from '@mui/material';

import type { MessageDesign } from '@/shared/lib';

const SEVERITY: Record<MessageDesign, AlertColor> = {
  Information: 'info',
  Success: 'success',
  Warning: 'warning',
  Error: 'error',
};

export interface MessageProps {
  text: string;
  design: MessageDesign;
}

/** Результат взаимодействия, отображаемый над содержимым, к которому он относится. */
export function Message({ text, design }: MessageProps) {
  return <Alert severity={SEVERITY[design]}>{text}</Alert>;
}
