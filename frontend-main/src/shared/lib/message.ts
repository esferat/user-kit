/** Человекочитаемая причина ошибки для оболочки; ошибка может быть любой. */
export function messageOfError(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message.trim() !== '') {
    return error.message;
  }
  if (typeof error === 'string' && error.trim() !== '') {
    return error;
  }
  return fallback;
}
