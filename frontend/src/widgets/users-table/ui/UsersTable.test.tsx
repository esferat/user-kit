import { fireEvent, render } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { UsersTable } from './UsersTable';

import type { Role, UserDto } from '@/entities/user';

import { i18n } from '@/shared/i18n';
import { formatDateTime } from '@/shared/lib';

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

function table(container: HTMLElement): HTMLElement & { loading: boolean } {
  return container.querySelector('ui5-table') as HTMLElement & { loading: boolean };
}

function rows(container: HTMLElement): HTMLElement[] {
  return [...container.querySelectorAll('ui5-table-row')] as HTMLElement[];
}

function cells(row: HTMLElement): (HTMLElement & { textContent: string })[] {
  return [...row.querySelectorAll('ui5-table-cell')] as (HTMLElement & { textContent: string })[];
}

function selectOf(row: HTMLElement): HTMLElement & { value: string } {
  return row.querySelector('ui5-select') as HTMLElement & { value: string };
}

function switchOf(row: HTMLElement): HTMLElement & { checked: boolean; disabled: boolean } {
  return row.querySelector('ui5-switch') as HTMLElement & { checked: boolean; disabled: boolean };
}

function changeRole(row: HTMLElement, value: string): void {
  fireEvent(selectOf(row), new CustomEvent('change', { bubbles: true, detail: { selectedOption: { value } } }));
}

beforeEach(() => {
  i18n.setLocale('ru');
});

describe('UsersTable', () => {
  it('labels the table and names its columns', () => {
    const { container } = render(<UsersTable users={[]} loading={false} onRoleChange={() => undefined} />);

    expect(container.querySelector('ui5-table')?.getAttribute('accessible-name')).toBe(i18n.t('users.table.label'));
    expect([...container.querySelectorAll('ui5-table-header-cell')].map((cell) => cell.textContent)).toEqual([
      i18n.t('users.column.email'),
      i18n.t('users.column.name'),
      i18n.t('users.column.role'),
      i18n.t('users.column.enabled'),
      i18n.t('users.column.updated'),
    ]);
  });

  it('shows the busy state of a reload', () => {
    const { container } = render(<UsersTable users={[]} loading onRoleChange={() => undefined} />);

    expect(table(container).loading).toBe(true);
  });

  it('renders a row per user', () => {
    const { container } = render(<UsersTable users={[ADMIN, PLAIN]} loading={false} onRoleChange={() => undefined} />);

    expect(rows(container)).toHaveLength(2);
    expect(rows(container)[0].getAttribute('data-id')).toBe('user-1');

    const [email, name, , , updated] = cells(rows(container)[0]);
    expect([email?.textContent, name?.textContent, updated?.textContent]).toEqual([
      ADMIN.email,
      ADMIN.displayName,
      formatDateTime(ADMIN.updatedAt),
    ]);
  });

  it('preselects the current role', () => {
    const { container } = render(<UsersTable users={[ADMIN, PLAIN]} loading={false} onRoleChange={() => undefined} />);

    expect(selectOf(rows(container)[0]).value).toBe('admin');
    expect(selectOf(rows(container)[1]).value).toBe('user');
    expect(selectOf(rows(container)[1]).getAttribute('accessible-name')).toBe(
      i18n.t('users.row.roleLabel', { email: PLAIN.email }),
    );
  });

  it('reports a role change with the user it belongs to', () => {
    const onRoleChange = vi.fn<(user: UserDto, role: Role) => void>();
    const { container } = render(<UsersTable users={[ADMIN, PLAIN]} loading={false} onRoleChange={onRoleChange} />);

    changeRole(rows(container)[1], 'admin');

    expect(onRoleChange).toHaveBeenCalledWith(PLAIN, 'admin');
  });

  it('shows the enabled state read only', () => {
    const { container } = render(<UsersTable users={[ADMIN, PLAIN]} loading={false} onRoleChange={() => undefined} />);

    expect(switchOf(rows(container)[0]).checked).toBe(true);
    expect(switchOf(rows(container)[0]).disabled).toBe(true);
    expect(switchOf(rows(container)[0]).getAttribute('accessible-name')).toBe(
      i18n.t('users.row.enabledLabel', { email: ADMIN.email }),
    );
    expect(switchOf(rows(container)[1]).checked).toBe(false);
  });

  it('renders nothing but the header without users', () => {
    const { container } = render(<UsersTable users={[]} loading={false} onRoleChange={() => undefined} />);

    expect(rows(container)).toHaveLength(0);
    expect(container.querySelector('ui5-table')?.getAttribute('no-data-text')).toBe(i18n.t('users.table.empty'));
  });
});
