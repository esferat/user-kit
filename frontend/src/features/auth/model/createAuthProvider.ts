import { CookieAuthProvider } from '../cookie/cookieAuthProvider';

import type { AuthProvider } from './types';

import type { AppConfig } from '@/shared/config';

import { DEFAULT_ROLE, normalizeRole } from '@/entities/user';

/**
 * Единственный провайдер: бэкенд во время выполнения решает, происходит вход
 * через identity provider или локально, поэтому сборке не нужен auth mode.
 */
export function createAuthProvider(config: AppConfig): AuthProvider {
  return new CookieAuthProvider(config.apiBaseUrl, normalizeRole(config.dev.role) ?? DEFAULT_ROLE);
}
