'use client';

import { Alert, Skeleton } from 'antd';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { useAuth } from '@/features/auth';
import { loadProfilePage, type RemoteProfilePage } from '@/shared/lib';

/**
 * Слот личного кабинета. Страница живёт в микрофронтенде `user-profile` (свой
 * домен) и подключается через Module Federation: компонент грузится на
 * клиенте, потому что manifest и чанки remote отдаёт другой origin, сервер их
 * не видит. Навигация к правке остаётся за хостом — remote получает её
 * колбэком, у него нет доступа к роутеру Next.js.
 */
export default function ProfilePage() {
  const auth = useAuth();
  const router = useRouter();
  const [Remote, setRemote] = useState<RemoteProfilePage | null>(null);
  const [failure, setFailure] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;

    loadProfilePage().then(
      (component) => {
        if (alive) {
          setRemote(() => component);
        }
      },
      (error: unknown) => {
        if (alive) {
          setFailure(error instanceof Error ? error.message : String(error));
        }
      },
    );

    return () => {
      alive = false;
    };
  }, []);

  if (failure !== null) {
    return (
      <Alert
        type="error"
        showIcon
        title="Не удалось загрузить личный кабинет"
        description={
          (
            <div style={{display: "flex", flexFlow: 'column'}}>
              <div>
                {'"Микрофронтенд user-profile недоступен — проверьте, что сервис user-profile поднят."'}
              </div>
              <div>
                {failure}
              </div>
            </div>
          )}
      />
    );
  }

  // Сессию ждём до показа remote: её отсутствие отправит BFF microfrontenda
  // в 401, и страница вместо кабинета показала бы ошибку загрузки.
  if (auth.status === 'restoring' || Remote === null) {
    return <Skeleton active paragraph={{rows: 6}}/>;
  }

  return <Remote onEdit={() => router.push('/profile/edit')}/>;
}
