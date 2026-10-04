import { Log, UserManager, WebStorageStateStore, type User, type UserManagerSettings } from 'oidc-client-ts';

import { AuthenticationError, type AuthProvider } from '../model/types';

import type { OidcConfig } from '@/shared/config';

import { toAuthenticatedUser, type AuthenticatedUser } from '@/entities/user';

const RETURN_URL_KEY = 'user-kit:return-url';

export function saveReturnUrl(url: string): void {
  window.sessionStorage.setItem(RETURN_URL_KEY, url);
}

export function consumeReturnUrl(): string | null {
  const value = window.sessionStorage.getItem(RETURN_URL_KEY);
  window.sessionStorage.removeItem(RETURN_URL_KEY);
  return value;
}

function isRedirectCallback(): boolean {
  const params = new URLSearchParams(window.location.search);
  return params.has('code') && params.has('state');
}

export function createUserManager(config: OidcConfig): UserManager {
  Log.setLevel(Log.WARN);

  const settings: UserManagerSettings = {
    authority: config.authority,
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    silent_redirect_uri: config.redirectUri,
    post_logout_redirect_uri: config.postLogoutRedirectUri || config.redirectUri,
    response_type: 'code',
    scope: config.scope,
    loadUserInfo: true,
    automaticSilentRenew: true,
    monitorSession: false,
    userStore: new WebStorageStateStore({ store: window.sessionStorage, prefix: 'user-kit:oidc:' }),
  };

  return new UserManager(settings);
}

/**
 * OIDC Authorization Code + PKCE, used against the Keycloak of docker compose and
 * any other standards compliant provider. Everything IdP specific is driven by
 * OIDC discovery.
 */
export class OidcAuthProvider implements AuthProvider {
  readonly kind = 'oidc' as const;

  private readonly manager: UserManager;
  private readonly config: OidcConfig;
  private readonly listeners = new Set<(user: AuthenticatedUser | null) => void>();
  private currentUser: AuthenticatedUser | null = null;

  constructor(config: OidcConfig, manager: UserManager = createUserManager(config)) {
    this.config = config;
    this.manager = manager;
  }

  private toUser(user: User): AuthenticatedUser {
    return toAuthenticatedUser(user.profile as Record<string, unknown>, {
      rolesClaim: this.config.rolesClaim === '' ? undefined : this.config.rolesClaim,
      clientId: this.config.clientId,
    });
  }

  private emit(): void {
    this.listeners.forEach((listener) => listener(this.currentUser));
  }

  async restore(): Promise<AuthenticatedUser | null> {
    try {
      if (isRedirectCallback()) {
        const user = await this.manager.signinRedirectCallback();
        this.currentUser = this.toUser(user);
        const returnUrl = consumeReturnUrl();
        const cleanUrl = `${window.location.pathname}${window.location.hash}`;
        window.history.replaceState({}, document.title, cleanUrl);
        if (returnUrl !== null && returnUrl !== '') {
          window.location.hash = returnUrl;
        }
        this.emit();
        return this.currentUser;
      }

      const user = await this.manager.getUser();
      if (user === null) {
        this.currentUser = null;
        this.emit();
        return null;
      }

      this.currentUser = this.toUser(user);
      this.emit();
      return this.currentUser;
    } catch (error) {
      await this.manager.removeUser();
      this.currentUser = null;
      this.emit();
      throw new AuthenticationError(error instanceof Error ? error.message : 'OIDC flow failed');
    }
  }

  async login(returnUrl?: string): Promise<void> {
    if (returnUrl !== undefined && returnUrl !== '') {
      saveReturnUrl(returnUrl);
    }
    await this.manager.signinRedirect();
  }

  async logout(): Promise<void> {
    await this.manager.removeUser();
    this.currentUser = null;
    this.emit();
    await this.manager.signoutRedirect();
  }

  async getAccessToken(): Promise<string | null> {
    const user = await this.manager.getUser();
    if (user === null) {
      return null;
    }
    if (user.expired !== true) {
      return user.access_token;
    }
    if (user.refresh_token === undefined) {
      return null;
    }

    try {
      const renewed = await this.manager.signinSilent();
      if (renewed === null) {
        return null;
      }
      await this.manager.storeUser(renewed);
      this.currentUser = this.toUser(renewed);
      return renewed.access_token;
    } catch {
      return null;
    }
  }

  onAuthenticated(listener: (user: AuthenticatedUser | null) => void): () => void {
    this.listeners.add(listener);
    listener(this.currentUser);
    return () => this.listeners.delete(listener);
  }
}
