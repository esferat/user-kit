import type { AppConfig } from '@/shared/config';

import { DEFAULT_ROLE } from '@/entities/user';

import type { AuthProvider } from '../model/types';
import { CookieAuthProvider } from './cookieAuthProvider';

/** Собирает провайдера аутентификации из публичной конфигурации приложения. */
export function createAuthProvider(config: AppConfig): AuthProvider {
  return new CookieAuthProvider(config.apiBaseUrl, DEFAULT_ROLE);
}
