import type { AuthenticatedUser, MeResponse, Role } from '@/entities/user';

import { joinUrl, ApiError, requestJson } from '@/shared/api';

import { AuthenticationError, type AuthConfig, type AuthProvider, type LoginOptions } from '../model/types';

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
 * Аутентификация на основе cookie. Бэкенд — OAuth-клиент: он обменивает код
 * авторизации, хранит refresh token в своей базе и выдаёт этому фронтенду
 * httpOnly cookie. Ни одна часть токена не попадает в этот бандл.
 */
export class CookieAuthProvider implements AuthProvider {
  private configPromise: Promise<AuthConfig> | null = null;
  private currentUser: AuthenticatedUser | null = null;
  private readonly listeners = new Set<(user: AuthenticatedUser | null) => void>();

  constructor(
    private readonly baseUrl: string,
    private readonly defaultDevRole: Role,
  ) {}

  /** Конфигурацию спрашиваем один раз; неудачу не кэшируем. */
  config(): Promise<AuthConfig> {
    this.configPromise ??= requestJson<AuthConfig>(joinUrl(this.baseUrl, '/api/v1/auth/config')).catch(
      (error: unknown) => {
        this.configPromise = null;
        throw error;
      },
    );
    return this.configPromise;
  }

  async restore(): Promise<AuthenticatedUser | null> {
    try {
      this.currentUser = toUser(await requestJson<MeResponse>(joinUrl(this.baseUrl, '/api/v1/me')));
    } catch (error) {
      this.currentUser = null;
      // Отсутствие сессии — обычное состояние экрана входа, любая другая
      // ошибка — проблема, которую должна показать оболочка.
      if (error instanceof ApiError && error.status === 401) {
        return null;
      }
      throw error;
    }
    return this.currentUser;
  }

  async login(options: LoginOptions = {}): Promise<void> {
    const { mode } = await this.config();
    if (mode === 'dev') {
      await this.devLogin(options.role ?? this.defaultDevRole);
      return;
    }
    if (mode === 'none') {
      throw new AuthenticationError('Вход отключён на сервере');
    }
    // Навигация верхнего уровня: браузер должен сам принять 302 и Set-Cookie
    // бэкенда, поэтому fetch здесь не подходит.
    window.location.assign(joinUrl(this.baseUrl, '/api/v1/auth/login'));
  }

  async logout(): Promise<void> {
    this.setUser(null);
    const response = await requestJson<LogoutResponse>(joinUrl(this.baseUrl, '/api/v1/auth/logout'), {
      method: 'POST',
      body: JSON.stringify({}),
    });
    if (response.redirectUrl !== null && response.redirectUrl !== '') {
      // Заодно завершает сессию провайдера: следующий вход будет новым запросом.
      window.location.assign(response.redirectUrl);
    }
  }

  onAuthenticated(listener: (user: AuthenticatedUser | null) => void): () => void {
    this.listeners.add(listener);
    listener(this.currentUser);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private async devLogin(role: Role): Promise<void> {
    const session = await requestJson<DevSessionResponse>(joinUrl(this.baseUrl, '/api/v1/auth/dev-login'), {
      method: 'POST',
      body: JSON.stringify({ role }),
    });
    this.setUser({
      subject: session.subject,
      username: session.email,
      displayName: session.displayName,
      email: session.email,
      roles: session.roles,
    });
  }

  private setUser(user: AuthenticatedUser | null): void {
    this.currentUser = user;
    for (const listener of this.listeners) {
      listener(user);
    }
  }
}
