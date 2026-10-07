import type { AuthenticatedUser, Role } from '@/entities/user';

/** Методы входа, которые может предлагать бэкенд. */
export type AuthMode = 'oidc' | 'dev' | 'none';

export interface LoginOptions {
  /** Hash-роут для возврата после того, как identity provider вернёт браузер. */
  returnUrl?: string;
  /** Роль локального dev-входа, игнорируется, если настроен провайдер. */
  role?: Role;
}

/**
 * Фасад аутентификации, который использует оболочка приложения.
 *
 * Реализация ровно одна: бэкенд владеет OAuth-клиентом, браузер хранит
 * только httpOnly cookie и спрашивает у бэкенда, кто он такой.
 */
export interface AuthProvider {
  /** Какой вход предлагает бэкенд, чтобы экран входа мог адаптироваться. */
  mode(): Promise<AuthMode>;
  restore(): Promise<AuthenticatedUser | null>;
  login(options?: LoginOptions): Promise<void>;
  logout(): Promise<void>;
  onAuthenticated(listener: (user: AuthenticatedUser | null) => void): () => void;
}

export class AuthenticationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AuthenticationError';
  }
}
