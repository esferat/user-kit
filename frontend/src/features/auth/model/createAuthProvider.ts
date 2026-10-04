import { DevAuthProvider } from '../dev/devAuthProvider';
import { OidcAuthProvider } from '../oidc/oidcAuthProvider';

import type { AuthProvider } from './types';

import { DEFAULT_ROLE, normalizeRole } from '@/entities/user';
import { assertConfigured, type AppConfig } from '@/shared/config';

/** Picks the provider that matches the configured authentication mode. */
export function createAuthProvider(config: AppConfig): AuthProvider {
  assertConfigured(config);
  return config.authMode === 'dev'
    ? new DevAuthProvider(config.apiBaseUrl, normalizeRole(config.dev.role) ?? DEFAULT_ROLE)
    : new OidcAuthProvider(config.oidc);
}
