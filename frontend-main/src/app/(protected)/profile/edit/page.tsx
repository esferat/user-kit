'use client';

import { App, Skeleton } from 'antd';
import { useRouter } from 'next/navigation';

import { useAuth } from '@/features/auth';
import { ProfileEditForm } from '@/features/profile-edit';

/**
 * Экран правки профиля. Собирает данные сессии с формой личного кабинета:
 * после сохранения сессия перечитывается, чтобы шапка показала новое имя.
 */
export default function ProfileEditPage() {
  const auth = useAuth();
  const router = useRouter();
  const { message } = App.useApp();

  if (auth.user === null) {
    return <Skeleton active paragraph={{ rows: 6 }} />;
  }

  return (
    <ProfileEditForm
      user={auth.user}
      onSaved={async () => {
        await auth.refresh();
        message.success('Профиль сохранён');
        router.push('/profile');
      }}
    />
  );
}
