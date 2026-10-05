import { AuthenticationError, type AuthMode, type AuthProvider, type LoginOptions } from '../model/types';

import type { AuthenticatedUser, MeResponse, Role } from '@/entities/user';

import { joinUrl, requestJson, ApiError } from '@/shared/api';

interface AuthConfigResponse {
  /** `oidc` for a real provider, `dev` for the local login, `none` if none is on. */
  mode: AuthMode;
  devEnabled: boolean;
  oidcConfigured: boolean;
}

interface DevSessionResponse {
  subject: string;
  displayName: string;
  email: string;
  roles: Role[];
  expiresAt: number;
}

interface LogoutResponse {
  /** Where to send the browser to end the provider session, null in the dev profile. */
  redirectUrl: string | null;
}

function toUser(response: MeResponse): AuthenticatedUser {
  return {
    subject: response.subject,
    username: response.email,
    displayName: response.displayName,
    email: response.email,
    roles: response.roles,
  };
}

/**
 * Cookie based authentication. The backend is the OAuth client: it exchanges the
 * authorization code, keeps the refresh token in its database and hands this
 * frontend two httpOnly cookies. Nothing about the token ever reaches this
 * bundle, which is the whole point of the setup.
 */
export class CookieAuthProvider implements AuthProvider {
  private readonly baseUrl: string;
  private readonly devRole: Role;
  private readonly listeners = new Set<(user: AuthenticatedUser | null) => void>();
  private currentUser: AuthenticatedUser | null = null;
  private cachedMode: AuthMode | null = null;

  constructor(baseUrl: string, devRole: Role) {
    this.baseUrl = baseUrl;
    this.devRole = devRole;
  }

  private emit(): void {
    this.listeners.forEach((listener) => listener(this.currentUser));
  }

  async mode(): Promise<AuthMode> {
    if (this.cachedMode !== null) {
      return this.cachedMode;
    }
    const response = await requestJson<AuthConfigResponse>(joinUrl(this.baseUrl, '/api/v1/auth/config'));
    this.cachedMode = response.mode;
    return response.mode;
  }

  async restore(): Promise<AuthenticatedUser | null> {
    try {
      this.currentUser = toUser(await requestJson<MeResponse>(joinUrl(this.baseUrl, '/api/v1/me')));
      this.emit();
      return this.currentUser;
    } catch (error) {
      this.currentUser = null;
      this.emit();
      // A missing session is the normal state of the login screen, anything else
      // is a problem the shell has to show.
      if (error instanceof ApiError && error.status === 401) {
        return null;
      }
      throw error;
    }
  }

  async login(options: LoginOptions = {}): Promise<void> {
    const mode = await this.mode();
    if (mode === 'dev') {
      await this.devLogin(options);
      return;
    }
    if (mode === 'none') {
      throw new AuthenticationError('The backend has no login method enabled');
    }
    // Top level navigation: the provider redirects the browser to the backend,
    // which sets the cookies and sends the visitor back to the application.
    const target = joinUrl(this.baseUrl, '/api/v1/auth/login');
    const returnUrl = options.returnUrl ?? window.location.hash;
    window.location.assign(
      returnUrl === '' || returnUrl === undefined ? target : `${target}?returnUrl=${encodeURIComponent(returnUrl)}`,
    );
  }

  private async devLogin(options: LoginOptions): Promise<void> {
    const role = options.role ?? this.devRole;
    const session = await requestJson<DevSessionResponse>(joinUrl(this.baseUrl, '/api/v1/auth/dev-login'), {
      method: 'POST',
      body: JSON.stringify({ role }),
    });
    this.currentUser = {
      subject: session.subject,
      username: session.email,
      displayName: session.displayName,
      email: session.email,
      roles: session.roles,
    };
    this.emit();
  }

  async logout(): Promise<void> {
    this.currentUser = null;
    this.emit();
    const response = await requestJson<LogoutResponse>(joinUrl(this.baseUrl, '/api/v1/auth/logout'), {
      method: 'POST',
      body: JSON.stringify({}),
    });
    if (response.redirectUrl !== null && response.redirectUrl !== '') {
      // Ends the session of the provider as well, so the next login asks again.
      window.location.assign(response.redirectUrl);
    }
  }

  onAuthenticated(listener: (user: AuthenticatedUser | null) => void): () => void {
    this.listeners.add(listener);
    listener(this.currentUser);
    return () => this.listeners.delete(listener);
  }
}
