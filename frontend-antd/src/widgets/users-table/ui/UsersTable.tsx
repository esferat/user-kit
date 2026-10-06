import { Switch, Table } from 'antd';
import { useMemo } from 'react';

import type { Role, UserDto } from '@/entities/user';

import { RoleSelect } from '@/features/user-role';
import { useTranslate } from '@/shared/i18n';
import { formatDateTime } from '@/shared/lib';

export interface UsersTableProps {
  users: readonly UserDto[];
  loading: boolean;
  onRoleChange(user: UserDto, role: Role): void;
}

/** Таблица страницы администрирования с назначением ролей прямо в строке. */
export function UsersTable({ users, loading, onRoleChange }: UsersTableProps) {
  const t = useTranslate();

  const columns = useMemo(
    () => [
      {
        title: t('users.column.email'),
        dataIndex: 'email',
        key: 'email',
      },
      {
        title: t('users.column.name'),
        key: 'displayName',
        render: (_value: unknown, user: UserDto) => user.displayName,
      },
      {
        title: t('users.column.role'),
        key: 'role',
        width: 200,
        render: (_value: unknown, user: UserDto) => (
          <RoleSelect
            value={user.roles.includes('admin') ? 'admin' : 'user'}
            accessibleName={t('users.row.roleLabel', { email: user.email })}
            onChange={(role) => {
              onRoleChange(user, role);
            }}
          />
        ),
      },
      {
        title: t('users.column.enabled'),
        key: 'enabled',
        width: 120,
        render: (_value: unknown, user: UserDto) => (
          <Switch checked={user.enabled} disabled aria-label={t('users.row.enabledLabel', { email: user.email })} />
        ),
      },
      {
        title: t('users.column.updated'),
        key: 'updated',
        render: (_value: unknown, user: UserDto) => formatDateTime(user.updatedAt),
      },
    ],
    [t, onRoleChange],
  );

  return (
    <Table<UserDto>
      aria-label={t('users.table.label')}
      rowKey="id"
      columns={columns}
      dataSource={[...users]}
      loading={loading}
      pagination={false}
      scroll={{ x: 'max-content' }}
      locale={{ emptyText: t('users.table.empty') }}
    />
  );
}
