import { beforeEach, describe, expect, it, vi } from 'vitest';

import { UsersStore } from './usersStore';

import type { Role, UserApi, UserDto } from '@/entities/user';

import { i18n } from '@/shared/i18n';

const ADMIN: UserDto = {
  id: 'user-1',
  subject: 'oidc-1',
  email: 'jane@user-kit.local',
  displayName: 'Jane Doe',
  roles: ['admin'],
  enabled: true,
  createdAt: '2026-02-10T09:15:00Z',
  updatedAt: '2026-02-11T10:20:00Z',
};

const PLAIN: UserDto = {
  ...ADMIN,
  id: 'user-2',
  subject: 'oidc-2',
  email: 'bob@user-kit.local',
  displayName: 'Bob Roe',
  roles: ['user'],
  enabled: false,
};

function createUserApi(users: UserDto[] = [ADMIN, PLAIN]): UserApi {
  let list = users;
  return {
    me: vi.fn(async () => ({ ...ADMIN, roles: ADMIN.roles })),
    list: vi.fn(async () => ({ items: list, total: list.length, page: 0, size: 100 })),
    updateRoles: vi.fn(async (id: string, roles: readonly Role[]) => {
      list = list.map((user) => (user.id === id ? { ...user, roles: [...roles] } : user));
      return list.find((user) => user.id === id) ?? ADMIN;
    }),
  };
}

beforeEach(() => {
  i18n.setLocale('ru');
});

describe('UsersStore', () => {
  it('asks for every user ordered by email', async () => {
    const userApi = createUserApi();
    const store = new UsersStore(userApi);

    const stop = store.start();

    await vi.waitFor(() => expect(store.users).toHaveLength(2));
    expect(userApi.list).toHaveBeenCalledWith({ sort: 'email', size: 100 });
    stop();
  });

  it('starts the request only once', async () => {
    const userApi = createUserApi();
    const store = new UsersStore(userApi);

    const first = store.start();
    const second = store.start();

    await vi.waitFor(() => expect(store.users).toHaveLength(2));
    expect(userApi.list).toHaveBeenCalledOnce();
    first();
    second();
  });

  it('reports a failed request as a message', async () => {
    const userApi = createUserApi();
    userApi.list = vi.fn(async () => {
      throw new Error('backend is down');
    });
    const store = new UsersStore(userApi);

    const stop = store.start();

    await vi.waitFor(() => expect(store.message?.text).toBe('backend is down'));
    expect(store.users).toEqual([]);
    stop();
  });

  it('assigns a role and reloads the list', async () => {
    const userApi = createUserApi();
    const store = new UsersStore(userApi);
    const stop = store.start();
    await vi.waitFor(() => expect(store.users).toHaveLength(2));

    await store.updateRoles(PLAIN, 'admin');

    expect(userApi.updateRoles).toHaveBeenCalledWith('user-2', ['admin']);
    expect(store.message?.text).toBe(
      i18n.t('users.message.roleUpdated', { email: PLAIN.email, role: i18n.t('roles.admin') }),
    );
    expect(store.users[1].roles).toEqual(['admin']);
    expect(userApi.list).toHaveBeenCalledTimes(2);
    stop();
  });

  it('reloads the list after a rejected change so the table shows the stored role', async () => {
    const userApi = createUserApi();
    userApi.updateRoles = vi.fn(async () => {
      throw new Error('role rejected');
    });
    const store = new UsersStore(userApi);
    const stop = store.start();
    await vi.waitFor(() => expect(store.users).toHaveLength(2));

    await store.updateRoles(PLAIN, 'admin');

    expect(store.message?.text).toBe('role rejected');
    expect(store.users[1].roles).toEqual(['user']);
    expect(userApi.list).toHaveBeenCalledTimes(2);
    stop();
  });

  it('drops the message on an explicit refresh', async () => {
    const userApi = createUserApi();
    const store = new UsersStore(userApi);
    const stop = store.start();
    await vi.waitFor(() => expect(store.users).toHaveLength(2));
    await store.updateRoles(PLAIN, 'admin');

    await store.refresh();

    expect(store.message).toBeUndefined();
    expect(userApi.list).toHaveBeenCalledTimes(3);
    stop();
  });
});
