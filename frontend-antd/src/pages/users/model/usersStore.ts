import { makeAutoObservable, reaction, runInAction } from 'mobx';

import type { Role, UserApi, UserDto, UserListQuery } from '@/entities/user';
import type { PageResponse } from '@/shared/api';
import type { AppMessage } from '@/shared/lib';

import { roleLabel } from '@/entities/user';
import { t } from '@/shared/i18n';
import { AsyncResource, messageOfError } from '@/shared/lib';

const LIST_QUERY: UserListQuery = { sort: 'email', size: 100 };

/**
 * Состояние страницы администрирования: пользователи backend и назначение
 * ролей. Запрос списка запускается в reaction метода `start`, поэтому
 * страница только отображает состояние стора.
 */
export class UsersStore {
  message: AppMessage | undefined = undefined;

  private readonly userApi: UserApi;
  private readonly list: AsyncResource<PageResponse<UserDto>>;
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
    return this.list.data?.items ?? [];
  }

  get loading(): boolean {
    return this.list.loading;
  }

  get error(): unknown {
    return this.list.error;
  }

  /** Однократно загружает пользователей и отслеживает ошибки запроса. */
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
   * Назначает одну роль и перезагружает список, чтобы таблица показывала то,
   * что принял backend. Отклонённое изменение тоже перезагружается: сохранённые
   * роли тогда совпадают с теми, что на экране.
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
