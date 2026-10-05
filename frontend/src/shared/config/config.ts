export interface DevAuthConfig {
  /**
   * Role requested from the dev login endpoint. Kept as the raw environment
   * value: `shared` must not know the role model of `entities/user`.
   */
  role: string;
}

export interface AppConfig {
  /** Empty string means "same origin", which is the default behind nginx. */
  apiBaseUrl: string;
  theme: string;
  /** Locale of the interface, validated against the dictionaries in `shared/i18n`. */
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
 * The build carries no identity provider settings: the login itself lives on the
 * backend, so nothing has to be validated before the application starts.
 */
export const config: AppConfig = readConfig(import.meta.env as unknown as Record<string, string | undefined>);
