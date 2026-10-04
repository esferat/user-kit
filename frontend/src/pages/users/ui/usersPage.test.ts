import '@ui5/webcomponents-icons/dist/AllIcons.js';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createUsersPage } from './usersPage';

import type { Role, UserApi, UserDto } from '@/entities/user';
import { roleLabel } from '@/entities/user';
import { i18n } from '@/shared/i18n';

const users: UserDto[] = [
  {
    id: 'u-1',
    subject: '1',
    email: 'jane@user-kit.local',
    displayName: 'Jane Doe',
    roles: ['user'],
    enabled: true,
    createdAt: '2026-01-02T10:00:00Z',
    updatedAt: '2026-01-03T10:00:00Z',
  },
  {
    id: 'u-2',
    subject: '2',
    email: 'root@user-kit.local',
    displayName: 'Root Doe',
    roles: ['admin', 'user'],
    enabled: false,
    createdAt: '2026-01-02T11:00:00Z',
    updatedAt: '2026-01-04T11:00:00Z',
  },
];

function createUserApi(overrides: Partial<UserApi> = {}): UserApi {
  return {
    me: vi.fn(),
    list: vi.fn().mockResolvedValue({ value: users }),
    updateRoles: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  } as unknown as UserApi;
}

function messages(page: HTMLElement): { text: string; design: string | null }[] {
  return [...page.querySelectorAll('ui5-message-strip')].map((strip) => ({
    text: strip.textContent ?? '',
    design: strip.getAttribute('design'),
  }));
}

function rows(page: HTMLElement): Element[] {
  return [...page.querySelectorAll('ui5-table-row')];
}

function changeRoleOf(page: HTMLElement, index: number, role: Role): void {
  const row = rows(page)[index];
  const selectedOption = [...row.querySelectorAll('ui5-option')].find(
    (option) => (option as Element & { value: string }).value === role,
  );
  row.querySelector('ui5-select')?.dispatchEvent(
    new CustomEvent('change', { detail: { selectedOption }, bubbles: true }),
  );
}

describe('createUsersPage', () => {
  beforeEach(() => {
    i18n.setLocale('ru');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders the title and the user table on the first load', async () => {
    const userApi = createUserApi();

    const page = createUsersPage({ userApi });
    document.body.appendChild(page);

    expect(page.querySelector('ui5-title')?.textContent).toBe(i18n.t('users.title'));
    await vi.waitFor(() => expect(rows(page)).toHaveLength(2));
    expect(userApi.list).toHaveBeenCalledWith({ orderBy: [{ property: 'email' }], top: 100, count: true });
    expect(messages(page)).toEqual([]);
  });

  it('reloads the users when the refresh button is used', async () => {
    const userApi = createUserApi();
    const page = createUsersPage({ userApi });
    document.body.appendChild(page);
    await vi.waitFor(() => expect(rows(page)).toHaveLength(2));

    const refresh = page.querySelectorAll('ui5-button')[0];
    refresh.dispatchEvent(new CustomEvent('click'));

    await vi.waitFor(() => expect(userApi.list).toHaveBeenCalledTimes(2));
  });

  it('reports a failed load', async () => {
    const userApi = createUserApi({
      list: vi.fn().mockRejectedValue(new Error('backend unreachable')),
    } as Partial<UserApi>);

    const page = createUsersPage({ userApi });
    document.body.appendChild(page);

    await vi.waitFor(() => expect(messages(page)).toHaveLength(1));
    expect(messages(page)[0]).toEqual({ text: 'backend unreachable', design: 'Negative' });
  });

  it('updates the roles of a user and reloads the list', async () => {
    const userApi = createUserApi();
    const page = createUsersPage({ userApi });
    document.body.appendChild(page);
    await vi.waitFor(() => expect(rows(page)).toHaveLength(2));

    changeRoleOf(page, 0, 'admin');

    await vi.waitFor(() => expect(userApi.updateRoles).toHaveBeenCalledWith('u-1', ['admin']));
    await vi.waitFor(() =>
      expect(messages(page)[0]).toEqual({
        text: i18n.t('users.message.roleUpdated', { email: 'jane@user-kit.local', role: roleLabel('admin') }),
        design: 'Positive',
      }),
    );
    await vi.waitFor(() => expect(userApi.list).toHaveBeenCalledTimes(2));
  });

  it('reports a rejected role change and still reloads the list', async () => {
    const userApi = createUserApi({
      updateRoles: vi.fn().mockRejectedValue(new Error('412 precondition failed')),
    } as Partial<UserApi>);
    const page = createUsersPage({ userApi });
    document.body.appendChild(page);
    await vi.waitFor(() => expect(rows(page)).toHaveLength(2));

    changeRoleOf(page, 1, 'user');

    await vi.waitFor(() => expect(messages(page)[0]?.text).toBe('412 precondition failed'));
    expect(messages(page)[0].design).toBe('Negative');
    await vi.waitFor(() => expect(userApi.list).toHaveBeenCalledTimes(2));
  });
});
