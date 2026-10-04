import '@ui5/webcomponents-icons/dist/AllIcons.js';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { Role, UserDto } from '@/entities/user';

import { createUsersTable } from './usersTable';

import { i18n } from '@/shared/i18n';
import { formatDateTime } from '@/shared/lib';

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

function selectOf(row: Element): Element & { value: string } {
  return row.querySelector('ui5-select') as Element & { value: string };
}

describe('createUsersTable', () => {
  beforeEach(() => {
    i18n.setLocale('ru');
  });

  it('renders the translated header cells', () => {
    const table = createUsersTable({ onRoleChange: vi.fn() });

    const headers = [...table.element.querySelectorAll('ui5-table-header-cell')];
    expect(headers.map((header) => header.textContent)).toEqual([
      i18n.t('users.column.email'),
      i18n.t('users.column.name'),
      i18n.t('users.column.role'),
      i18n.t('users.column.enabled'),
      i18n.t('users.column.updated'),
    ]);
  });

  it('renders one row per user with the current role and activation', () => {
    const table = createUsersTable({ onRoleChange: vi.fn() });

    table.setUsers(users);

    const rows = [...table.element.querySelectorAll('ui5-table-row')];
    expect(rows).toHaveLength(2);
    expect(rows[0].getAttribute('data-id')).toBe('u-1');
    expect(selectOf(rows[0]).value).toBe('user');
    expect(selectOf(rows[1]).value).toBe('admin');

    const switches = [...table.element.querySelectorAll('ui5-switch')] as (Element & {
      checked: boolean;
      disabled: boolean;
    })[];
    expect(switches.map((entry) => entry.checked)).toEqual([true, false]);
    expect(switches.every((entry) => entry.disabled)).toBe(true);
  });

  it('shows the formatted update timestamp', () => {
    const table = createUsersTable({ onRoleChange: vi.fn() });

    table.setUsers([users[0]]);

    const cells = [...table.element.querySelectorAll('ui5-table-cell')];
    expect(cells.at(-1)?.textContent).toBe(formatDateTime(users[0].updatedAt));
  });

  it('reports a role change of a row', () => {
    const onRoleChange = vi.fn<(user: UserDto, role: Role) => void>();
    const table = createUsersTable({ onRoleChange });
    table.setUsers(users);

    const row = table.element.querySelectorAll('ui5-table-row')[0];
    const selectedOption = [...row.querySelectorAll('ui5-option')].find(
      (option) => (option as Element & { value: string }).value === 'admin',
    );
    selectOf(row).dispatchEvent(
      new CustomEvent('change', { detail: { selectedOption }, bubbles: true }),
    );

    expect(onRoleChange).toHaveBeenCalledWith(users[0], 'admin');
  });

  it('ignores an unknown role of a change event', () => {
    const onRoleChange = vi.fn();
    const table = createUsersTable({ onRoleChange });
    table.setUsers([users[0]]);

    const row = table.element.querySelectorAll('ui5-table-row')[0];
    selectOf(row).dispatchEvent(
      new CustomEvent('change', { detail: { selectedOption: { value: 'superuser' } }, bubbles: true }),
    );

    expect(onRoleChange).not.toHaveBeenCalled();
    expect(selectOf(row).value).toBe('user');
  });

  it('replaces the rows on every update', () => {
    const table = createUsersTable({ onRoleChange: vi.fn() });

    table.setUsers(users);
    table.setUsers([users[1]]);

    const rows = [...table.element.querySelectorAll('ui5-table-row')];
    expect(rows).toHaveLength(1);
    expect(rows[0].getAttribute('data-id')).toBe('u-2');
  });

  it('shows the loading state and the empty text of the table', () => {
    const table = createUsersTable({ onRoleChange: vi.fn() });

    table.setLoading(true);
    expect((table.element as unknown as { loading: boolean }).loading).toBe(true);

    table.setUsers([]);
    expect((table.element as unknown as { noDataText: string }).noDataText).toBe(
      i18n.t('users.table.empty'),
    );
  });
});
