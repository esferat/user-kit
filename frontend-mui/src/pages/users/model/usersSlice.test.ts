import { configureStore } from '@reduxjs/toolkit';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { listUsers, refreshUsers, selectUsers, updateUserRole, usersReducer } from './usersSlice';

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
    me: vi.fn(async () => ({
      id: ADMIN.id,
      subject: ADMIN.subject,
      email: ADMIN.email,
      displayName: ADMIN.displayName,
      roles: ADMIN.roles,
      enabled: ADMIN.enabled,
    })),
    list: vi.fn(async () => ({ value: list, count: list.length })),
    updateRoles: vi.fn(async (id: string, roles: readonly Role[]) => {
      list = list.map((user) => (user.id === id ? { ...user, roles: [...roles] } : user));
      return list.find((user) => user.id === id) ?? ADMIN;
    }),
  };
}

function createStore(userApi: UserApi) {
  return configureStore({
    reducer: { users: usersReducer },
    middleware: (getDefault) => getDefault({ thunk: { extraArgument: { services: { userApi } } } }),
  });
}

beforeEach(() => {
  i18n.setLocale('ru');
  vi.clearAllMocks();
});

describe('usersSlice', () => {
  it('loads every user ordered by email', async () => {
    const userApi = createUserApi();
    const store = createStore(userApi);

    await store.dispatch(listUsers());

    expect(userApi.list).toHaveBeenCalledWith({ orderBy: [{ property: 'email' }], top: 100, count: true });
    expect(selectUsers(store.getState()).users).toEqual([ADMIN, PLAIN]);
  });

  it('reports a failed list as a message', async () => {
    const userApi = createUserApi();
    userApi.list = vi.fn(async () => {
      throw new Error('backend is down');
    });
    const store = createStore(userApi);

    await store.dispatch(listUsers());

    const state = selectUsers(store.getState());
    expect(state.users).toEqual([]);
    expect(state.message?.text).toBe('backend is down');
    expect(state.message?.design).toBe('Error');
  });

  it('reloads on a refresh and drops the shown message', async () => {
    const userApi = createUserApi();
    const store = createStore(userApi);
    await store.dispatch(listUsers());
    await store.dispatch(updateUserRole({ user: ADMIN, role: 'user' }));
    expect(selectUsers(store.getState()).message?.design).toBe('Success');

    await store.dispatch(refreshUsers());

    expect(userApi.list).toHaveBeenCalledTimes(3);
    expect(selectUsers(store.getState()).message).toBeUndefined();
  });

  it('assigns a new role and reloads the list', async () => {
    const userApi = createUserApi();
    const store = createStore(userApi);
    await store.dispatch(listUsers());

    await store.dispatch(updateUserRole({ user: PLAIN, role: 'admin' }));

    expect(userApi.updateRoles).toHaveBeenCalledWith('user-2', ['admin']);
    expect(selectUsers(store.getState()).message?.text).toBe(
      i18n.t('users.message.roleUpdated', { email: PLAIN.email, role: i18n.t('roles.admin') }),
    );
    expect(selectUsers(store.getState()).users[1].roles).toEqual(['admin']);
    expect(userApi.list).toHaveBeenCalledTimes(2);
  });

  it('restores the real role and reports a rejected change', async () => {
    const userApi = createUserApi();
    userApi.updateRoles = vi.fn(async () => {
      throw new Error('role rejected');
    });
    const store = createStore(userApi);
    await store.dispatch(listUsers());

    await store.dispatch(updateUserRole({ user: PLAIN, role: 'admin' }));

    const state = selectUsers(store.getState());
    expect(state.message?.text).toBe('role rejected');
    expect(state.message?.design).toBe('Error');
    expect(state.users[1].roles).toEqual(['user']);
    expect(userApi.list).toHaveBeenCalledTimes(2);
  });
});
