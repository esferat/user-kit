import { CookieAuthProvider } from '../cookie/cookieAuthProvider';

import type { AuthProvider } from './types';

import type { AppConfig } from '@/shared/config';

import { DEFAULT_ROLE, normalizeRole } from '@/entities/user';

/**
 * The only provider: the backend decides at runtime whether a login happens
 * against an identity provider or locally, so the build needs no auth mode.
 */
export function createAuthProvider(config: AppConfig): AuthProvider {
  return new CookieAuthProvider(config.apiBaseUrl, normalizeRole(config.dev.role) ?? DEFAULT_ROLE);
}
