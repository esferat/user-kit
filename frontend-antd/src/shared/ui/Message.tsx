import { Alert } from 'antd';

import type { MessageDesign } from '@/shared/lib';

import { MESSAGE_DESIGN } from '@/shared/lib';

export interface MessageProps {
  text: string;
  design: MessageDesign;
}

/** Результат взаимодействия, отображаемый над содержимым, к которому он относится. */
export function Message({ text, design }: MessageProps) {
  return <Alert type={MESSAGE_DESIGN[design]} title={text} showIcon />;
}
