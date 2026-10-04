import '@ui5/webcomponents/dist/Switch.js';
import '@ui5/webcomponents/dist/Table.js';
import '@ui5/webcomponents/dist/TableCell.js';
import '@ui5/webcomponents/dist/TableHeaderCell.js';
import '@ui5/webcomponents/dist/TableHeaderRow.js';
import '@ui5/webcomponents/dist/TableRow.js';

import type Switch from '@ui5/webcomponents/dist/Switch.js';
import type Table from '@ui5/webcomponents/dist/Table.js';

import type { Role, UserDto } from '@/entities/user';

import { createRoleSelect, roleSelectCell } from '@/features/user-role';
import { t } from '@/shared/i18n';
import { element, formatDateTime } from '@/shared/lib';

export interface UsersTableOptions {
  onRoleChange(user: UserDto, role: Role): void;
}

export interface UsersTable {
  readonly element: HTMLElement;
  setLoading(loading: boolean): void;
  setUsers(users: readonly UserDto[]): void;
}

const COLUMNS: ReadonlyArray<{ key: string; width: string }> = [
  { key: 'users.column.email', width: '30%' },
  { key: 'users.column.name', width: '25%' },
  { key: 'users.column.role', width: '25%' },
  { key: 'users.column.enabled', width: '10%' },
  { key: 'users.column.updated', width: '20%' },
];

function enabledCell(user: UserDto): HTMLElement {
  const cell = document.createElement('ui5-table-cell');
  const enabledSwitch = document.createElement('ui5-switch') as Switch;
  enabledSwitch.checked = user.enabled;
  enabledSwitch.disabled = true;
  enabledSwitch.accessibleName = t('users.row.enabledLabel', { email: user.email });
  cell.appendChild(enabledSwitch);
  return cell;
}

/** Table of the administration page with the inline role assignment. */
export function createUsersTable(options: UsersTableOptions): UsersTable {
  const table = document.createElement('ui5-table') as Table;
  table.accessibleName = t('users.table.label');
  table.noDataText = t('users.table.empty');
  table.overflowMode = 'Scroll';

  const headerRow = document.createElement('ui5-table-header-row');
  COLUMNS.forEach((column) => {
    const cell = element('ui5-table-header-cell', { text: t(column.key) });
    cell.setAttribute('width', column.width);
    headerRow.appendChild(cell);
  });
  table.appendChild(headerRow);

  function buildRow(user: UserDto): HTMLElement {
    const row = document.createElement('ui5-table-row');
    row.setAttribute('data-id', user.id);
    row.appendChild(element('ui5-table-cell', { text: user.email }));
    row.appendChild(element('ui5-table-cell', { text: user.displayName }));
    row.appendChild(
      roleSelectCell(
        createRoleSelect({
          value: user.roles.includes('admin') ? 'admin' : 'user',
          accessibleName: t('users.row.roleLabel', { email: user.email }),
          onChange: (role) => {
            options.onRoleChange(user, role);
          },
        }),
      ),
    );
    row.appendChild(enabledCell(user));
    row.appendChild(element('ui5-table-cell', { text: formatDateTime(user.updatedAt) }));
    return row;
  }

  return {
    element: table,
    setLoading(loading: boolean): void {
      table.loading = loading;
    },
    setUsers(users: readonly UserDto[]): void {
      table.querySelectorAll('ui5-table-row').forEach((row) => row.remove());
      users.forEach((user) => table.appendChild(buildRow(user)));
      table.noDataText = t('users.table.empty');
    },
  };
}
