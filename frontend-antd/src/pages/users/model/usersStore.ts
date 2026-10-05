import { makeAutoObservable, reaction, runInAction } from 'mobx';

import type { Role, UserApi, UserDto } from '@/entities/user';
import type { ODataListResponse, ODataQuery } from '@/shared/api';
import type { AppMessage } from '@/shared/lib';

import { roleLabel } from '@/entities/user';
import { t } from '@/shared/i18n';
import { AsyncResource, messageOfError } from '@/shared/lib';

const LIST_QUERY: ODataQuery = { orderBy: [{ property: 'email' }], top: 100, count: true };

/**
 * State of the administration page: the users of the backend and the role
 * assignment. The list request is started by the reaction of `start`, so the
 * page only renders the state of the store.
 */
export class UsersStore {
  message: AppMessage | undefined = undefined;

  private readonly userApi: UserApi;
  private readonly list: AsyncResource<ODataListResponse<UserDto>>;
  private dispose: (() => void) | null = null;

  constructor(userApi: UserApi) {
    this.userApi = userApi;
    this.list = new AsyncResource(() => userApi.list(LIST_QUERY));
    makeAutoObservable<UsersStore, 'userApi' | 'list' | 'dispose'>(
      this,
      { userApi: false, list: false, dispose: false },
      { autoBind: true },
    );
  }

  get users(): readonly UserDto[] {
    return this.list.data?.value ?? [];
  }

  get loading(): boolean {
    return this.list.loading;
  }

  get error(): unknown {
    return this.list.error;
  }

  /** Loads the users once and follows the failures of the request. */
  start(): () => void {
    if (this.dispose === null) {
      this.dispose = reaction(
        () => this.list.error,
        (error) => {
          if (error !== undefined) {
            this.fail(error);
          }
        },
      );
      void this.list.fetch();
    }
    return this.stop;
  }

  stop(): void {
    this.dispose?.();
    this.dispose = null;
  }

  clearMessage(): void {
    this.message = undefined;
  }

  async refresh(): Promise<void> {
    this.clearMessage();
    await this.list.fetch();
  }

  /**
   * Assigns a single role and reloads the list, so the table shows what the
   * backend accepted. A rejected change is reloaded as well: the stored roles
   * are then the ones on screen.
   */
  async updateRoles(user: UserDto, role: Role): Promise<void> {
    this.clearMessage();
    try {
      await this.userApi.updateRoles(user.id, [role]);
      runInAction(() => {
        this.show({
          text: t('users.message.roleUpdated', { email: user.email, role: roleLabel(role) }),
          design: 'Success',
        });
      });
    } catch (error) {
      runInAction(() => this.fail(error));
    }
    await this.list.fetch();
  }

  private show(message: AppMessage): void {
    this.message = message;
  }

  private fail(error: unknown): void {
    this.message = { text: messageOfError(error, t('common.unknownError')), design: 'Error' };
  }
}
