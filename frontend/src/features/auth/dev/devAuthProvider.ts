import { AuthenticationError, type AuthProvider } from '../model/types';

import type { AuthenticatedUser, Role } from '@/entities/user';

import { joinUrl } from '@/shared/api';

const SESSION_KEY = 'user-kit:dev-session';

interface DevSession {
  accessToken: string;
  expiresAt: number;
  subject: string;
  email: string;
  displayName: string;
  roles: Role[];
}

interface DevTokenResponse {
  accessToken: string;
  tokenType: string;
  expiresAt: number;
  subject: string;
  email: string;
  displayName: string;
  roles: Role[];
}

/**
 * Development-only authentication against the backend endpoint
 * `/api/v1/dev/token` (enabled by the `dev` Spring profile). It exists so the
 * stack can be started without a licensed IdP; never enable it in production.
 */
export class DevAuthProvider implements AuthProvider {
  readonly kind = 'dev' as const;

  private readonly baseUrl: string;
  private readonly role: Role;
  private readonly listeners = new Set<(user: AuthenticatedUser | null) => void>();
  private currentUser: AuthenticatedUser | null = null;

  constructor(baseUrl: string, role: Role) {
    this.baseUrl = baseUrl;
    this.role = role;
  }

  private static toUser(session: DevSession): AuthenticatedUser {
    return {
      subject: session.subject,
      username: session.email,
      displayName: session.displayName,
      email: session.email,
      roles: session.roles,
    };
  }

  private emit(): void {
    this.listeners.forEach((listener) => listener(this.currentUser));
  }

  async restore(): Promise<AuthenticatedUser | null> {
    const raw = window.sessionStorage.getItem(SESSION_KEY);
    if (raw === null) {
      this.currentUser = null;
      this.emit();
      return null;
    }

    let session: DevSession;
    try {
      session = JSON.parse(raw) as DevSession;
    } catch {
      window.sessionStorage.removeItem(SESSION_KEY);
      this.currentUser = null;
      this.emit();
      return null;
    }

    if (session.expiresAt <= Math.floor(Date.now() / 1000)) {
      window.sessionStorage.removeItem(SESSION_KEY);
      this.currentUser = null;
      this.emit();
      return null;
    }

    this.currentUser = DevAuthProvider.toUser(session);
    this.emit();
    return this.currentUser;
  }

  async login(): Promise<void> {
    const url = joinUrl(this.baseUrl, `/api/v1/dev/token?role=${encodeURIComponent(this.role)}`);
    const response = await fetch(url, { headers: { Accept: 'application/json' } });
    if (!response.ok) {
      throw new AuthenticationError(
        `Dev token endpoint is unavailable (${response.status}). Start the backend with the "dev" profile.`,
      );
    }

    const payload = (await response.json()) as DevTokenResponse;
    const session: DevSession = {
      accessToken: payload.accessToken,
      expiresAt: payload.expiresAt,
      subject: payload.subject,
      email: payload.email,
      displayName: payload.displayName,
      roles: payload.roles,
    };

    window.sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
    this.currentUser = DevAuthProvider.toUser(session);
    this.emit();
  }

  async logout(): Promise<void> {
    window.sessionStorage.removeItem(SESSION_KEY);
    this.currentUser = null;
    this.emit();
  }

  async getAccessToken(): Promise<string | null> {
    const raw = window.sessionStorage.getItem(SESSION_KEY);
    if (raw === null) {
      return null;
    }
    const session = JSON.parse(raw) as DevSession;
    return session.expiresAt > Math.floor(Date.now() / 1000) ? session.accessToken : null;
  }

  onAuthenticated(listener: (user: AuthenticatedUser | null) => void): () => void {
    this.listeners.add(listener);
    listener(this.currentUser);
    return () => this.listeners.delete(listener);
  }
}
