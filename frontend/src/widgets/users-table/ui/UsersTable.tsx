import { Switch } from '@ui5/webcomponents-react/Switch';
import { Table } from '@ui5/webcomponents-react/Table';
import { TableCell } from '@ui5/webcomponents-react/TableCell';
import { TableHeaderCell } from '@ui5/webcomponents-react/TableHeaderCell';
import { TableHeaderRow } from '@ui5/webcomponents-react/TableHeaderRow';
import { TableRow } from '@ui5/webcomponents-react/TableRow';

import type { Role, UserDto } from '@/entities/user';

import { RoleSelect } from '@/features/user-role';
import { useTranslate } from '@/shared/i18n';
import { formatDateTime } from '@/shared/lib';

export interface UsersTableProps {
  users: readonly UserDto[];
  loading: boolean;
  onRoleChange(user: UserDto, role: Role): void;
}

const COLUMNS: ReadonlyArray<{ key: string; width: string }> = [
  { key: 'users.column.email', width: '30%' },
  { key: 'users.column.name', width: '25%' },
  { key: 'users.column.role', width: '25%' },
  { key: 'users.column.enabled', width: '10%' },
  { key: 'users.column.updated', width: '20%' },
];

/** Таблица страницы администрирования с назначением ролей прямо в строке. */
export function UsersTable({ users, loading, onRoleChange }: UsersTableProps) {
  const t = useTranslate();

  return (
    <Table
      accessibleName={t('users.table.label')}
      noDataText={t('users.table.empty')}
      overflowMode="Scroll"
      loading={loading}
    >
      <TableHeaderRow>
        {COLUMNS.map((column) => (
          <TableHeaderCell key={column.key} width={column.width}>
            {t(column.key)}
          </TableHeaderCell>
        ))}
      </TableHeaderRow>
      {users.map((user) => (
        <TableRow key={user.id} rowKey={user.id} data-id={user.id}>
          <TableCell>{user.email}</TableCell>
          <TableCell>{user.displayName}</TableCell>
          <TableCell>
            <RoleSelect
              value={user.roles.includes('admin') ? 'admin' : 'user'}
              accessibleName={t('users.row.roleLabel', { email: user.email })}
              onChange={(role) => {
                onRoleChange(user, role);
              }}
            />
          </TableCell>
          <TableCell>
            <Switch
              checked={user.enabled}
              disabled
              accessibleName={t('users.row.enabledLabel', { email: user.email })}
            />
          </TableCell>
          <TableCell>{formatDateTime(user.updatedAt)}</TableCell>
        </TableRow>
      ))}
    </Table>
  );
}
