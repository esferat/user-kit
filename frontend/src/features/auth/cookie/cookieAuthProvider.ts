import { AuthenticationError, type AuthMode, type AuthProvider, type LoginOptions } from '../model/types';

import type { AuthenticatedUser, MeResponse, Role } from '@/entities/user';

import { joinUrl, requestJson, ApiError } from '@/shared/api';

interface AuthConfigResponse {
  /** `oidc` — настоящий провайдер, `dev` — локальный вход, `none` — вход не включён. */
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
  /** Куда отправить браузер, чтобы завершить сессию провайдера, null в dev-профиле. */
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
 * Аутентификация на основе cookie. Бэкенд — OAuth-клиент: он обменивает
 * код авторизации, хранит refresh token в своей базе данных и выдаёт
 * этому фронтенду два httpOnly cookie. Ни одна часть токена не попадает
 * в этот бандл — в этом весь смысл такой схемы.
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
      // Отсутствие сессии — обычное состояние экрана входа, любая другая
      // ошибка — проблема, которую должна показать оболочка.
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
    // Навигация верхнего уровня: провайдер перенаправляет браузер на бэкенд,
    // который ставит cookie и возвращает посетителя в приложение.
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
      // Заодно завершает и сессию провайдера, поэтому при следующем входе будет новый запрос.
      window.location.assign(response.redirectUrl);
    }
  }

  onAuthenticated(listener: (user: AuthenticatedUser | null) => void): () => void {
    this.listeners.add(listener);
    listener(this.currentUser);
    return () => this.listeners.delete(listener);
  }
}
