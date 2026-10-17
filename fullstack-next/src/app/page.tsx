'use client';

import { Button, Typography } from 'antd';
import { useRouter } from 'next/navigation';

import { useAuth } from '@/features/auth';

/**
 * Публичный лендинг. Маршрут открыт анонимно (см. `src/proxy.ts`), приватные
 * разделы живут в группе `(protected)`. Кнопка ведёт на экран входа для гостя и
 * в личный кабинет для вошедшего пользователя.
 */
export default function Home() {
  const auth = useAuth();
  const router = useRouter();
  const authenticated = auth.status === 'authenticated' && auth.user !== null;

  return (
    <section style={{ maxWidth: 640, margin: '0 auto', paddingTop: '10vh', textAlign: 'center' }}>
      <Typography.Title>User Kit</Typography.Title>
      <Typography.Paragraph type="secondary" style={{ fontSize: 16 }}>
        Хранилище файлов с авторизацией через Keycloak. Войдите, чтобы управлять своими документами.
      </Typography.Paragraph>
      <Button
        type="primary"
        size="large"
        onClick={() => router.push(authenticated ? '/profile' : '/login')}
      >
        {authenticated ? 'Личный кабинет' : 'Войти'}
      </Button>
    </section>
  );
}
