/** Семантический дизайн сообщения в коде приложения. */
export type MessageDesign = 'Information' | 'Success' | 'Warning' | 'Error';

/** Сопоставляет семантический дизайн, используемый в коде, с типами `antd-alert`. */
export const MESSAGE_DESIGN: Record<MessageDesign, 'info' | 'success' | 'warning' | 'error'> = {
  Information: 'info',
  Success: 'success',
  Warning: 'warning',
  Error: 'error',
};

/** Читает сообщение неудавшегося запроса, при необходимости возвращая универсальный текст. */
export function messageOfError(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

/** Сообщение о завершённом действии пользователя. */
export interface AppMessage {
  text: string;
  design: MessageDesign;
}
