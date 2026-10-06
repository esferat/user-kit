/** Семантический дизайн сообщения в коде приложения. */
export type MessageDesign = 'Information' | 'Success' | 'Warning' | 'Error';

/** Сопоставляет семантический дизайн, используемый в коде, с дизайнами `ui5-message-strip`. */
export const MESSAGE_DESIGN: Record<MessageDesign, 'Information' | 'Positive' | 'Critical' | 'Negative'> = {
  Information: 'Information',
  Success: 'Positive',
  Warning: 'Critical',
  Error: 'Negative',
};

/** Читает сообщение неудавшегося запроса, при необходимости возвращая универсальный текст. */
export function messageOfError(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

/** Сообщение о завершённом пользовательском действии. */
export interface AppMessage {
  text: string;
  design: MessageDesign;
}
