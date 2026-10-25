'use client';

import { Button, Space, Typography } from 'antd';
import { useRouter } from 'next/navigation';

import { ProfileCard } from '@/entities/user';
import { useAuth } from '@/features/auth';

export default function ProfilePage() {
  const auth = useAuth();
  const router = useRouter();

  return (
    <>
      <Typography.Title level={2} style={{ marginTop: 0 }}>
        Личный кабинет
      </Typography.Title>
      <Typography.Paragraph type="secondary">
        Профиль приходит с бэкенда по httpOnly cookie, токенов в браузере нет.
      </Typography.Paragraph>

      {auth.status === 'restoring' && <Typography.Text>Загружаем профиль…</Typography.Text>}
      {auth.user !== null && (
        <Space orientation="vertical" size="middle" style={{ display: 'flex' }}>
          <Button type="primary" onClick={() => router.push('/profile/edit')}>
            Редактировать
          </Button>
          <ProfileCard user={auth.user} />
        </Space>
      )}
    </>
  );
}
