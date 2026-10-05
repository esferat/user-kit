import type { AuthenticatedUser, Role } from '@/entities/user';

/** Login methods the backend can offer. */
export type AuthMode = 'oidc' | 'dev' | 'none';

export interface LoginOptions {
  /** Hash route to return to after the identity provider sent the browser back. */
  returnUrl?: string;
  /** Role of the local dev login, ignored when a provider is configured. */
  role?: Role;
}

/**
 * Authentication facade used by the application shell.
 *
 * There is exactly one implementation: the backend owns the OAuth client, the
 * browser holds nothing but an httpOnly cookie and asks the backend who it is.
 */
export interface AuthProvider {
  /** Which login the backend offers, so the login screen can adapt. */
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
