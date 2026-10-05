import { makeAutoObservable, runInAction } from 'mobx';

import type { AuthMode, AuthProvider, LoginOptions } from './types';

import type { AuthenticatedUser, Role } from '@/entities/user';

import { t } from '@/shared/i18n';
import { AsyncResource, messageOfError } from '@/shared/lib';

/** State of the session of the current user. */
export type AuthStatus = 'restoring' | 'anonymous' | 'authenticated';

/**
 * Authentication as observable state.
 *
 * The session is restored once per store, so `StrictMode` mounting the tree
 * twice does not send a second request, and every later change the provider
 * reports - the logout of the profile menu, a dev login - becomes an observable
 * the shell renders. The login methods the backend offers are read the same way,
 * because the login screen can only adapt after the backend has answered.
 */
export class SessionStore {
  user: AuthenticatedUser | null = null;
  status: AuthStatus = 'restoring';
  /** Reason of a failed session restore, shown on the login screen. */
  error: unknown = undefined;
  /** Reason of a failed login or of an unreachable backend, shown as a message. */
  failure: string | undefined = undefined;
  /** A login is on its way, either to the provider or to the dev session. */
  pending = false;

  private readonly auth: AuthProvider;
  private readonly mode: AsyncResource<AuthMode>;
  private unsubscribe: (() => void) | null = null;
  /** The restore is on its way, so its result is not known yet. */
  private restoring = false;
  /** The restore has settled; only now a reported user is the current one. */
  private restored = false;
  /** The login methods have been asked for; they do not change while the page lives. */
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

  /** Which login the backend offers, `null` while it has not answered. */
  get loginMode(): AuthMode | null {
    return this.mode.data ?? null;
  }

  get modeLoading(): boolean {
    return this.mode.loading;
  }

  /** Follows the provider and restores the session once. */
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

  /** Reads the login methods the backend offers. */
  async loadMode(): Promise<void> {
    await this.mode.fetch();
    if (this.mode.error !== undefined) {
      runInAction(() => {
        this.failure = messageOfError(this.mode.error, t('login.failed'));
      });
    }
  }

  /**
   * Logs the user in. With a provider the browser has left the page by now and
   * the promise never settles here; the local dev login authenticates in place,
   * so the session is restored again afterwards.
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
      // The backend clears the cookies before it answers, so a failing redirect
      // leaves nothing to recover: the session keeps what the provider reported
      // and the reason only deserves the console.
      console.error('logout failed', error);
    }
  }

  private apply(user: AuthenticatedUser | null): void {
    this.user = user;
    this.status = user === null ? 'anonymous' : 'authenticated';
    this.error = undefined;
  }
}
