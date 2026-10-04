import type { AuthenticatedUser } from '@/entities/user';

export type AuthProviderKind = 'oidc' | 'dev';

/**
 * Authentication facade used by the application shell.
 *
 * `oidc` talks to an identity provider (Keycloak in docker compose) using
 * Authorization Code + PKCE. `dev` uses the token endpoint of the backend
 * (`/api/v1/dev/token`) which is only enabled with the `dev` Spring profile.
 */
export interface AuthProvider {
  readonly kind: AuthProviderKind;
  restore(): Promise<AuthenticatedUser | null>;
  login(returnUrl?: string): Promise<void>;
  logout(): Promise<void>;
  getAccessToken(): Promise<string | null>;
  onAuthenticated(listener: (user: AuthenticatedUser | null) => void): () => void;
}

export class AuthenticationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AuthenticationError';
  }
}
