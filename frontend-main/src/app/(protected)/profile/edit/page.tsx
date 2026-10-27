'use client';

import {Alert, Skeleton} from 'antd';
import {useEffect, useState} from 'react';

import {useAuth} from '@/features/auth';
import {loadProfileEdit, type RemoteProfileEdit} from '@/shared/lib';

/**
 * Слот правки профиля. Форма живёт в микрофронтенде `user-profile` (свой домен)
 * и подключается через Module Federation: компонент грузится на клиенте, потому
 * что manifest и чанки remote отдаёт другой origin, сервер их не видит.
 */
export default function ProfileEditPage() {
  const auth = useAuth();
  const [Remote, setRemote] = useState<RemoteProfileEdit | null>(null);
  const [failure, setFailure] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;

    loadProfileEdit().then(
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
        title="Не удалось загрузить форму профиля"
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

  if (auth.user === null || Remote === null) {
    return <Skeleton active paragraph={{rows: 6}}/>;
  }

  return <Remote/>;
}
