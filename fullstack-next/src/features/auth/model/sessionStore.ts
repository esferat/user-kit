import type { AuthenticatedUser, Role } from '@/entities/user';

import { messageOfError } from '@/shared/lib';
import type { AuthMode, AuthProvider } from './types';

/** Состояние сессии текущего пользователя. */
export type AuthStatus = 'restoring' | 'anonymous' | 'authenticated' | 'error';

export interface AuthSnapshot {
  user: AuthenticatedUser | null;
  status: AuthStatus;
  /** Режим входа, как его назвал бэкенд; `null`, пока конфигурация не пришла. */
  mode: AuthMode | null;
  /** Причина последней неудачи для показа пользователю. */
  failure: string | undefined;
  /** Идёт запрос входа: кнопки блокируются, чтобы не отправить его дважды. */
  pending: boolean;
}

const INITIAL: AuthSnapshot = {
  user: null,
  status: 'restoring',
  mode: null,
  failure: undefined,
  pending: false,
};

/**
 * Сессия как внешний store для `useSyncExternalStore`.
 *
 * Восстановление идёт один раз на store, поэтому повторное монтирование дерева
 * в dev-режиме не отправляет второй запрос. Каждое изменение (dev-вход, выход,
 * подхваченный провайдером пользователь) становится новым снимком и перерисовывает
 * подписанные компоненты.
 */
export class SessionStore {
  private snapshot: AuthSnapshot = INITIAL;
  private readonly listeners = new Set<() => void>();
  private unsubscribe: (() => void) | null = null;
  private started = false;
  private restored = false;

  constructor(private readonly auth: AuthProvider) {}

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  getSnapshot = (): AuthSnapshot => this.snapshot;

  /** Стабильный снимок для серверного рендера, иначе гидратация разойдётся. */
  getServerSnapshot = (): AuthSnapshot => INITIAL;

  start = (): void => {
    if (this.started) {
      return;
    }
    this.started = true;
    this.unsubscribe = this.auth.onAuthenticated((user) => {
      if (this.restored) {
        this.apply(user);
      }
    });
    void this.restore();
    void this.loadMode();
  };

  stop = (): void => {
    this.unsubscribe?.();
    this.unsubscribe = null;
    this.started = false;
  };

  login = async (role?: Role): Promise<void> => {
    this.patch({ pending: true, failure: undefined });
    try {
      await this.auth.login(role === undefined ? {} : { role });
    } catch (error) {
      this.patch({ failure: messageOfError(error, 'Не удалось войти. Попробуйте ещё раз.') });
    } finally {
      this.patch({ pending: false });
    }
  };

  logout = async (): Promise<void> => {
    try {
      await this.auth.logout();
    } catch (error) {
      // Выход уже стёр локальную сессию; сетевую неудачу только логируем.
      console.error('Не удалось завершить сессию', error);
    }
  };

  private async restore(): Promise<void> {
    try {
      const user = await this.auth.restore();
      this.restored = true;
      this.apply(user);
    } catch (error) {
      this.restored = true;
      this.patch({
        user: null,
        status: 'error',
        failure: messageOfError(error, 'Не удалось проверить сессию.'),
      });
    }
  }

  private async loadMode(): Promise<void> {
    try {
      const { mode } = await this.auth.config();
      this.patch({ mode });
    } catch (error) {
      this.patch({ failure: messageOfError(error, 'Сервер авторизации недоступен.') });
    }
  }

  private apply(user: AuthenticatedUser | null): void {
    this.patch({
      user,
      status: user === null ? 'anonymous' : 'authenticated',
      failure: undefined,
    });
  }

  private patch(patch: Partial<AuthSnapshot>): void {
    this.snapshot = { ...this.snapshot, ...patch };
    for (const listener of this.listeners) {
      listener();
    }
  }
}
