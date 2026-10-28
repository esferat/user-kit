import { Descriptions, Tag, Typography } from 'antd';

import { type MeResponse } from '@shared/model';

import { ProfileAvatar } from './ProfileAvatar';

/** Карточка профиля: только чтение, правка живёт в фиче `profile-edit`. */
export function ProfileCard({ profile }: { profile: MeResponse }) {
  return (
    <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
      <ProfileAvatar displayName={profile.displayName} avatarUrl={profile.avatarUrl} />
      <Descriptions
        column={1}
        size="small"
        items={[
          { key: 'username', label: 'Логин', children: profile.username },
          { key: 'displayName', label: 'Имя', children: profile.displayName },
          {
            key: 'email',
            label: 'Почта',
            children: profile.email || (
              <Typography.Text type="secondary">не указана</Typography.Text>
            ),
          },
          {
            key: 'roles',
            label: 'Роли',
            children: profile.roles.map((role) => <Tag key={role}>{role}</Tag>),
          },
        ]}
      />
    </div>
  );
}
