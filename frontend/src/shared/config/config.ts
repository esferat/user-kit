export interface DevAuthConfig {
  /**
   * Роль, запрашиваемая у dev-эндпоинта входа. Хранится как есть из переменной
   * окружения: `shared` не должен знать модель ролей `entities/user`.
   */
  role: string;
}

export interface AppConfig {
  /** Пустая строка означает «тот же origin», так настроен nginx по умолчанию. */
  apiBaseUrl: string;
  theme: string;
  /** Язык интерфейса, сверяемый со словарями в `shared/i18n`. */
  defaultLocale: string;
  dev: DevAuthConfig;
}

export class ConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConfigurationError';
  }
}

const DEFAULT_DEV_ROLE = 'user';

function trimmed(value: string | undefined): string | undefined {
  const result = value?.trim();
  return result === undefined || result === '' ? undefined : result;
}

function stripTrailingSlash(value: string): string {
  return value.endsWith('/') ? value.slice(0, -1) : value;
}

export function readConfig(env: Record<string, string | undefined>): AppConfig {
  return {
    apiBaseUrl: stripTrailingSlash(trimmed(env.VITE_API_BASE_URL) ?? ''),
    theme: trimmed(env.VITE_UI5_THEME) ?? 'sap_horizon',
    defaultLocale: trimmed(env.VITE_DEFAULT_LOCALE) ?? 'ru',
    dev: {
      role: trimmed(env.VITE_DEV_ROLE) ?? DEFAULT_DEV_ROLE,
    },
  };
}

/**
 * В сборке нет настроек провайдера идентификации: сам вход живёт на бэкенде,
 * поэтому перед запуском приложения ничего не нужно проверять.
 */
export const config: AppConfig = readConfig(import.meta.env as unknown as Record<string, string | undefined>);
