'use client';

import Link from 'next/link';

import { Avatar, Button, Dropdown, Space, Tag, Typography } from 'antd';

import { initialsOf } from '@/shared/lib';

import { useAuth } from '../model/useAuth';

/** Меню профиля: кто вошёл, роли и выход. Без сессии предлагает войти. */
export function ProfileMenu() {
  const auth = useAuth();
  const user = auth.user;

  if (user === null) {
    return (
      <Link href="/login">
        <Button type="primary">Войти</Button>
      </Link>
    );
  }

  return (
    <Dropdown
      trigger={['click']}
      menu={{
        items: [
          {
            key: 'profile',
            disabled: true,
            label: (
              <Space direction="vertical" size={0}>
                <Typography.Text strong>{user.displayName}</Typography.Text>
                <Typography.Text type="secondary">{user.email}</Typography.Text>
                <Space size={4}>
                  {user.roles.map((role) => (
                    <Tag key={role} color={role === 'admin' ? 'gold' : 'blue'}>
                      {role}
                    </Tag>
                  ))}
                </Space>
              </Space>
            ),
          },
          { type: 'divider' },
          { key: 'logout', label: 'Выйти', danger: true },
        ],
        onClick: ({ key }) => {
          if (key === 'logout') {
            void auth.logout();
          }
        },
      }}
    >
      <Button type="text" style={{ color: '#fff', height: 'auto', padding: 4 }}>
        <Space>
          <Avatar size="small">{initialsOf(user.displayName)}</Avatar>
          {user.displayName}
        </Space>
      </Button>
    </Dropdown>
  );
}
