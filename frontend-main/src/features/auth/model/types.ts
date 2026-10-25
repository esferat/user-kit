import type { AuthenticatedUser, Role } from '@/entities/user';

/** `oidc` — настоящий провайдер, `dev` — локальный вход, `none` — вход отключён. */
export type AuthMode = 'oidc' | 'dev' | 'none';

/** Ответ `GET /api/v1/auth/config`. */
export interface AuthConfig {
  mode: AuthMode;
  devEnabled: boolean;
  oidcConfigured: boolean;
  registrationEnabled: boolean;
}

export interface LoginOptions {
  /** Роль dev-входа; в OIDC-режиме не используется. */
  role?: Role;
}

export class AuthenticationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AuthenticationError';
  }
}

/**
 * Фасад аутентификации. Реализация одна: бэкенд владеет OAuth-клиентом, а
 * браузер хранит только httpOnly cookie и спрашивает у бэкенда, кто он.
 */
export interface AuthProvider {
  config(): Promise<AuthConfig>;
  restore(): Promise<AuthenticatedUser | null>;
  login(options?: LoginOptions): Promise<void>;
  logout(): Promise<void>;
  onAuthenticated(listener: (user: AuthenticatedUser | null) => void): () => void;
}
