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

function table(container: HTMLElement): HTMLTableElement {
  return container.querySelector('table') as HTMLTableElement;
}

function rows(container: HTMLElement): HTMLElement[] {
  return [...container.querySelectorAll('tbody tr.ant-table-row')] as HTMLElement[];
}

function cells(row: HTMLElement): string[] {
  return [...row.querySelectorAll('td')].map((cell) => cell.textContent ?? '');
}

function selectOf(row: HTMLElement): HTMLElement {
  return row.querySelector('.ant-select') as HTMLElement;
}

/** The trigger of the select shows the label of the assigned role. */
function selectedRole(row: HTMLElement): string {
  return (selectOf(row).querySelector('.ant-select-content') as HTMLElement).title;
}

function switchOf(row: HTMLElement): HTMLButtonElement {
  return row.querySelector('button.ant-switch') as HTMLButtonElement;
}

function isLoading(container: HTMLElement): boolean {
  return container.querySelector('.ant-spin')?.classList.contains('ant-spin-spinning') ?? false;
}

/** Without users the table renders the empty text as the text of the placeholder row. */
function emptyText(container: HTMLElement): string | undefined {
  return container.querySelector('tbody .ant-table-placeholder')?.textContent ?? undefined;
}

/** Opens the dropdown of the row and picks the option of that role. */
function changeRole(row: HTMLElement, role: Role): void {
  fireEvent.mouseDown(selectOf(row).querySelector('.ant-select-content') as Element);
  const option = [...document.querySelectorAll('.ant-select-item-option')].find(
    (entry) => entry.textContent === i18n.t(`roles.${role}`),
  );
  if (option) {
    fireEvent.click(option);
  }
}

beforeEach(() => {
  i18n.setLocale('ru');
});

describe('UsersTable', () => {
  it('labels the table and names its columns', () => {
    const { container } = render(<UsersTable users={[]} loading={false} onRoleChange={() => undefined} />);

    expect(table(container).getAttribute('aria-label')).toBe(i18n.t('users.table.label'));
    expect([...container.querySelectorAll('thead th')].map((cell) => cell.textContent ?? '')).toEqual([
      i18n.t('users.column.email'),
      i18n.t('users.column.name'),
      i18n.t('users.column.role'),
      i18n.t('users.column.enabled'),
      i18n.t('users.column.updated'),
    ]);
  });

  it('shows the busy state of a reload', () => {
    const { container } = render(<UsersTable users={[]} loading onRoleChange={() => undefined} />);

    expect(isLoading(container)).toBe(true);
  });

  it('renders a row per user', () => {
    const { container } = render(<UsersTable users={[ADMIN, PLAIN]} loading={false} onRoleChange={() => undefined} />);

    expect(rows(container)).toHaveLength(2);

    const [email, name, , , updated] = cells(rows(container)[0]);
    expect([email, name, updated]).toEqual([ADMIN.email, ADMIN.displayName, formatDateTime(ADMIN.updatedAt)]);
  });

  it('preselects the current role and names the dropdown', () => {
    const { container } = render(<UsersTable users={[ADMIN, PLAIN]} loading={false} onRoleChange={() => undefined} />);

    expect(selectedRole(rows(container)[0])).toBe(i18n.t('roles.admin'));
    expect(selectedRole(rows(container)[1])).toBe(i18n.t('roles.user'));
    expect(selectOf(rows(container)[1]).querySelector('input[aria-label]')?.getAttribute('aria-label')).toBe(
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

    expect(switchOf(rows(container)[0]).classList.contains('ant-switch-checked')).toBe(true);
    expect(switchOf(rows(container)[0]).disabled).toBe(true);
    expect(switchOf(rows(container)[0]).getAttribute('aria-label')).toBe(
      i18n.t('users.row.enabledLabel', { email: ADMIN.email }),
    );
    expect(switchOf(rows(container)[1]).classList.contains('ant-switch-checked')).toBe(false);
  });

  it('renders the empty text without users', () => {
    const { container } = render(<UsersTable users={[]} loading={false} onRoleChange={() => undefined} />);

    expect(rows(container)).toHaveLength(0);
    expect(emptyText(container)).toBe(i18n.t('users.table.empty'));
  });
});
