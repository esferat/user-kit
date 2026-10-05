import { fireEvent, render, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { UsersStore } from '../model/usersStore';

import { UsersPage } from './UsersPage';

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
    list: vi.fn(async () => ({ value: list, count: list.length })),
    updateRoles: vi.fn(async (id: string, roles: readonly Role[]) => {
      list = list.map((user) => (user.id === id ? { ...user, roles: [...roles] } : user));
      return list.find((user) => user.id === id) ?? ADMIN;
    }),
  };
}

function renderPage(userApi: UserApi) {
  return render(<UsersPage store={new UsersStore(userApi)} />);
}

function rows(container: HTMLElement): HTMLElement[] {
  return [...container.querySelectorAll('ui5-table-row')] as HTMLElement[];
}

function selectOf(container: HTMLElement, row: number): HTMLElement & { value: string } {
  return rows(container)[row].querySelector('ui5-select') as HTMLElement & { value: string };
}

function changeRole(container: HTMLElement, row: number, value: string): void {
  fireEvent(
    selectOf(container, row),
    new CustomEvent('change', { bubbles: true, detail: { selectedOption: { value } } }),
  );
}

function refreshButton(container: HTMLElement): HTMLElement {
  return container.querySelector('ui5-toolbar-button') as HTMLElement;
}

function strip(container: HTMLElement): string | null {
  return container.querySelector('ui5-message-strip')?.textContent ?? null;
}

beforeEach(() => {
  i18n.setLocale('ru');
});

describe('UsersPage', () => {
  it('loads every user ordered by email', async () => {
    const userApi = createUserApi();
    const { container } = renderPage(userApi);

    await waitFor(() => expect(rows(container)).toHaveLength(2));
    expect(container.querySelector('ui5-title')?.textContent).toBe(i18n.t('users.title'));
    expect(userApi.list).toHaveBeenCalledWith({ orderBy: [{ property: 'email' }], top: 100, count: true });
  });

  it('offers a reload of the list', async () => {
    const userApi = createUserApi();
    const { container } = renderPage(userApi);
    await waitFor(() => expect(rows(container)).toHaveLength(2));

    expect(refreshButton(container).getAttribute('accessible-name')).toBe(i18n.t('users.refresh'));

    fireEvent.click(refreshButton(container));
    await waitFor(() => expect(userApi.list).toHaveBeenCalledTimes(2));
  });

  it('assigns a new role and reloads the list', async () => {
    const userApi = createUserApi();
    const { container } = renderPage(userApi);
    await waitFor(() => expect(rows(container)).toHaveLength(2));

    changeRole(container, 1, 'admin');

    await waitFor(() => expect(userApi.updateRoles).toHaveBeenCalledWith('user-2', ['admin']));
    await waitFor(() => expect(userApi.list).toHaveBeenCalledTimes(2));
    await waitFor(() =>
      expect(strip(container)).toContain(
        i18n.t('users.message.roleUpdated', { email: PLAIN.email, role: i18n.t('roles.admin') }),
      ),
    );
  });

  it('keeps the given role for an unchanged selection', async () => {
    const userApi = createUserApi();
    const { container } = renderPage(userApi);
    await waitFor(() => expect(rows(container)).toHaveLength(2));

    changeRole(container, 0, 'admin');

    expect(userApi.updateRoles).not.toHaveBeenCalled();
    expect(userApi.list).toHaveBeenCalledOnce();
  });

  it('restores the real role and reports a rejected change', async () => {
    const userApi = createUserApi();
    userApi.updateRoles = vi.fn(async () => {
      throw new Error('role rejected');
    });
    const { container } = renderPage(userApi);
    await waitFor(() => expect(rows(container)).toHaveLength(2));

    changeRole(container, 1, 'admin');

    await waitFor(() => expect(strip(container)).toContain('role rejected'));
    await waitFor(() => expect(userApi.list).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(selectOf(container, 1).value).toBe('user'));
  });

  it('reports a failed reload of the list', async () => {
    const userApi = createUserApi();
    userApi.list = vi.fn(async () => {
      throw new Error('backend is down');
    });
    const { container } = renderPage(userApi);

    await waitFor(() => expect(strip(container)).toContain('backend is down'));
    expect(rows(container)).toHaveLength(0);
  });

  it('drops the message on an explicit refresh', async () => {
    const userApi = createUserApi();
    const { container } = renderPage(userApi);
    await waitFor(() => expect(rows(container)).toHaveLength(2));

    changeRole(container, 1, 'admin');
    await waitFor(() => expect(strip(container)).not.toBeNull());

    fireEvent.click(refreshButton(container));
    await waitFor(() => expect(userApi.list).toHaveBeenCalledTimes(3));
    expect(strip(container)).toBeNull();
  });
});
