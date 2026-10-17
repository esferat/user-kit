'use client';

import { Typography } from 'antd';

import { ProfileCard } from '@/entities/user';
import { useAuth } from '@/features/auth';

export default function ProfilePage() {
  const auth = useAuth();

  return (
    <>
      <Typography.Title level={2} style={{ marginTop: 0 }}>
        Личный кабинет
      </Typography.Title>
      <Typography.Paragraph type="secondary">
        Профиль приходит с бэкенда по httpOnly cookie, токенов в браузере нет.
      </Typography.Paragraph>

      {auth.status === 'restoring' && <Typography.Text>Загружаем профиль…</Typography.Text>}
      {auth.user !== null && <ProfileCard user={auth.user} />}
    </>
  );
}
