export type AuthMode = 'oidc' | 'dev';

export interface OidcConfig {
  authority: string;
  clientId: string;
  redirectUri: string;
  postLogoutRedirectUri: string;
  scope: string;
  rolesClaim: string;
}

export interface DevAuthConfig {
  /**
   * Role requested from the dev token endpoint. Kept as the raw environment
   * value: `shared` must not know the role model of `entities/user`.
   */
  role: string;
}

export interface AppConfig {
  /** Empty string means "same origin", which is the default behind nginx. */
  apiBaseUrl: string;
  authMode: AuthMode;
  theme: string;
  /** Locale of the interface, validated against the dictionaries in `shared/i18n`. */
  defaultLocale: string;
  oidc: OidcConfig;
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
  const authModeRaw = (trimmed(env.VITE_AUTH_MODE) ?? 'oidc').toLowerCase();
  if (authModeRaw !== 'oidc' && authModeRaw !== 'dev') {
    throw new ConfigurationError(`VITE_AUTH_MODE must be "oidc" or "dev", got "${authModeRaw}"`);
  }

  return {
    apiBaseUrl: stripTrailingSlash(trimmed(env.VITE_API_BASE_URL) ?? ''),
    authMode: authModeRaw,
    theme: trimmed(env.VITE_UI5_THEME) ?? 'sap_horizon',
    defaultLocale: trimmed(env.VITE_DEFAULT_LOCALE) ?? 'ru',
    oidc: {
      authority: trimmed(env.VITE_OIDC_AUTHORITY) ?? '',
      clientId: trimmed(env.VITE_OIDC_CLIENT_ID) ?? 'user-kit-web',
      redirectUri: trimmed(env.VITE_OIDC_REDIRECT_URI) ?? '',
      postLogoutRedirectUri: trimmed(env.VITE_OIDC_POST_LOGOUT_REDIRECT_URI) ?? '',
      scope: trimmed(env.VITE_OIDC_SCOPE) ?? 'openid profile email',
      rolesClaim: trimmed(env.VITE_OIDC_ROLES_CLAIM) ?? '',
    },
    dev: {
      role: trimmed(env.VITE_DEV_ROLE) ?? DEFAULT_DEV_ROLE,
    },
  };
}

export function assertConfigured(config: AppConfig): void {
  if (config.authMode === 'oidc') {
    const missing = (['VITE_OIDC_AUTHORITY', 'VITE_OIDC_REDIRECT_URI'] as const).filter(
      (key) => !config.oidc[key === 'VITE_OIDC_AUTHORITY' ? 'authority' : 'redirectUri'],
    );
    if (missing.length > 0) {
      throw new ConfigurationError(`Missing OIDC settings: ${missing.join(', ')}`);
    }
  }
}

export const config: AppConfig = readConfig(import.meta.env as unknown as Record<string, string | undefined>);
