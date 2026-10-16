/** Публичная конфигурация фронтенда. Секретов здесь быть не может. */
export interface AppConfig {
  /**
   * База REST API. Пустая строка означает same-origin: nginx на одном домене
   * проксирует `/api` на бэкенд, поэтому абсолютный адрес не нужен.
   */
  apiBaseUrl: string;
}

/** Убирает хвостовой слэш, чтобы склейка путей не давала двойной слэш. */
export function normalizeBaseUrl(value: string): string {
  const trimmed = value.trim();
  return trimmed.endsWith('/') ? trimmed.slice(0, -1) : trimmed;
}

// NEXT_PUBLIC_* инлайнится компилятором на этапе сборки, поэтому обращение к
// переменной должно быть статичным, а не через объект окружения.
const apiBaseUrl = normalizeBaseUrl(process.env.NEXT_PUBLIC_API_BASE_URL ?? '');

export const appConfig: AppConfig = { apiBaseUrl };
