import { makeAutoObservable, runInAction } from 'mobx';

import type { AuthMode, AuthProvider, LoginOptions } from './types';

import type { AuthenticatedUser, Role } from '@/entities/user';

import { t } from '@/shared/i18n';
import { AsyncResource, messageOfError } from '@/shared/lib';

/** Состояние сессии текущего пользователя. */
export type AuthStatus = 'restoring' | 'anonymous' | 'authenticated';

/**
 * Аутентификация как observable-состояние.
 *
 * Сессия восстанавливается один раз на store, поэтому двойное монтирование
 * дерева в `StrictMode` не отправляет второй запрос, а каждое последующее
 * изменение от провайдера - выход в меню профиля, dev-вход - становится
 * observable, который рендерит оболочка. Методы входа, которые предлагает
 * бэкенд, читаются так же, потому что экран входа может адаптироваться
 * только после ответа бэкенда.
 */
export class SessionStore {
  user: AuthenticatedUser | null = null;
  status: AuthStatus = 'restoring';
  /** Причина неудачного восстановления сессии, показывается на экране входа. */
  error: unknown = undefined;
  /** Причина неудачного входа или недоступного бэкенда, показывается сообщением. */
  failure: string | undefined = undefined;
  /** Вход выполняется: либо у провайдера, либо в dev-сессию. */
  pending = false;

  private readonly auth: AuthProvider;
  private readonly mode: AsyncResource<AuthMode>;
  private unsubscribe: (() => void) | null = null;
  /** Восстановление выполняется, поэтому результат ещё неизвестен. */
  private restoring = false;
  /** Восстановление завершено; только теперь переданный пользователь становится текущим. */
  private restored = false;
  /** Методы входа уже запрошены; они не меняются, пока жива страница. */
  private modeRequested = false;

  constructor(auth: AuthProvider) {
    this.auth = auth;
    this.mode = new AsyncResource(() => auth.mode());
    makeAutoObservable<SessionStore, 'auth' | 'mode' | 'unsubscribe' | 'restoring' | 'restored' | 'modeRequested'>(
      this,
      { auth: false, mode: false, unsubscribe: false, restoring: false, restored: false, modeRequested: false },
      { autoBind: true },
    );
  }

  /** Какой вход предлагает бэкенд, `null`, пока он не ответил. */
  get loginMode(): AuthMode | null {
    return this.mode.data ?? null;
  }

  get modeLoading(): boolean {
    return this.mode.loading;
  }

  /** Следит за провайдером и восстанавливает сессию один раз. */
  start(): () => void {
    if (this.unsubscribe === null) {
      this.unsubscribe = this.auth.onAuthenticated((user) => {
        if (this.restored) {
          this.apply(user);
        }
      });

      if (!this.restored && !this.restoring) {
        this.restoring = true;
        void this.auth.restore().then(
          (user) =>
            runInAction(() => {
              this.restoring = false;
              this.restored = true;
              this.apply(user);
            }),
          (error: unknown) =>
            runInAction(() => {
              this.restoring = false;
              this.restored = true;
              this.user = null;
              this.status = 'anonymous';
              this.error = error;
            }),
        );
      }

      if (!this.modeRequested) {
        this.modeRequested = true;
        void this.loadMode();
      }
    }
    return this.stop;
  }

  stop(): void {
    this.unsubscribe?.();
    this.unsubscribe = null;
  }

  /** Читает методы входа, которые предлагает бэкенд. */
  async loadMode(): Promise<void> {
    await this.mode.fetch();
    if (this.mode.error !== undefined) {
      runInAction(() => {
        this.failure = messageOfError(this.mode.error, t('login.failed'));
      });
    }
  }

  /**
   * Выполняет вход пользователя. С провайдером браузер к этому моменту уже
   * ушёл со страницы и promise здесь не завершится; локальный dev-вход
   * аутентифицирует на месте, поэтому после него сессия восстанавливается снова.
   */
  async login(returnUrl?: string, role?: Role): Promise<void> {
    const options: LoginOptions = role === undefined ? { returnUrl } : { returnUrl, role };
    this.pending = true;
    this.failure = undefined;
    try {
      await this.auth.login(options);
      const user = await this.auth.restore();
      runInAction(() => {
        this.restored = true;
        this.apply(user);
      });
    } catch (error) {
      runInAction(() => {
        this.failure = messageOfError(error, t('login.failed'));
      });
    } finally {
      runInAction(() => {
        this.pending = false;
      });
    }
  }

  async logout(): Promise<void> {
    try {
      await this.auth.logout();
    } catch (error) {
      // Бэкенд очищает cookie ещё до ответа, поэтому при неудачном редиректе
      // восстанавливать нечего: сессия сохраняет то, что сообщил провайдер,
      // а причина годится лишь для консоли.
      console.error('logout failed', error);
    }
  }

  private apply(user: AuthenticatedUser | null): void {
    this.user = user;
    this.status = user === null ? 'anonymous' : 'authenticated';
    this.error = undefined;
  }
}
