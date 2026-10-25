import { Avatar, Card, Descriptions, Space, Tag, Typography, type DescriptionsProps } from 'antd';

import { initialsOf } from '@/shared/lib';
import type { AuthenticatedUser } from '../model/types';

/**
 * Карточка профиля: данные уже пришли с бэкенда, компонент только показывает их.
 */
export function ProfileCard({ user }: { user: AuthenticatedUser }) {
  const items: DescriptionsProps['items'] = [
    { key: 'name', label: 'Имя', children: user.displayName },
    { key: 'email', label: 'Почта', children: user.email ?? '—' },
    { key: 'subject', label: 'Идентификатор', children: user.subject },
    {
      key: 'roles',
      label: 'Роли',
      children: user.roles.map((role) => (
        <Tag key={role} color={role === 'admin' ? 'gold' : 'blue'}>
          {role}
        </Tag>
      )),
    },
  ];

  return (
    <Card title="Профиль" style={{ maxWidth: 640 }}>
      <Space align="center" size={16} style={{ marginBottom: 24 }}>
        <Avatar size={80} src={user.avatarUrl ?? undefined}>
          {initialsOf(user.displayName)}
        </Avatar>
        <Typography.Text strong style={{ fontSize: 18 }}>
          {user.displayName}
        </Typography.Text>
      </Space>
      <Descriptions column={1} size="middle" items={items} />
    </Card>
  );
}
