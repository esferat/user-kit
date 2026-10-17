import { Card, Descriptions, Tag, type DescriptionsProps } from 'antd';
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
      <Descriptions column={1} size="middle" items={items} />
    </Card>
  );
}
