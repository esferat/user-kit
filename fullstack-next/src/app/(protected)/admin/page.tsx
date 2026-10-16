'use client';

import { Result, Skeleton } from 'antd';

import { hasAdmin } from '@/entities/user';
import { useAuth } from '@/features/auth';

export default function AdminPage() {
  const auth = useAuth();

  if (auth.status === 'restoring') {
    return <Skeleton active paragraph={{ rows: 4 }} />;
  }

  if (!hasAdmin(auth.user)) {
    return (
      <Result
        status="403"
        title="403"
        subTitle="Раздел доступен только роли admin. Скрытие в интерфейсе — это UX, доступ к данным проверяет бэкенд."
      />
    );
  }

  return (
    <Result
      status="success"
      title="Администрирование"
      subTitle="Раздел роли admin. Реальные операции выполняет бэкенд, который проверяет роль на своей стороне."
    />
  );
}
