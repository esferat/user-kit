import { Button, Space, Spin, Typography } from 'antd';

import { ProfileCard, useProfileQuery } from '@entities/user';
import { messageOfError } from '@shared/lib';

export interface ProfileViewProps {
  /**
   * Переход на правку профиля. Навигатором владеет рендерящее приложение:
   * у хоста frontend-main это `next/navigation`, у локального маршрута —
   * роутер Modern.js, поэтому сюда приходит уже готовый колбэк.
   */
  onEdit: () => void;
}

/**
 * Страница «Личный кабинет»: карточка профиля и переход к правке.
 *
 * Перенесена из frontend-main целиком: данные читаются через BFF этого
 * микрофронтенда (`/profile-api/profile`), сессия — httpOnly cookie того же
 * origin, токены в браузер не попадают.
 */
export function ProfileView({ onEdit }: ProfileViewProps) {
  const profile = useProfileQuery();

  return (
    <>
      <Typography.Title level={2} style={{ marginTop: 0 }}>
        Личный кабинет
      </Typography.Title>
      <Typography.Paragraph type="secondary">
        Профиль приходит с бэкенда по httpOnly cookie, токенов в браузере нет.
      </Typography.Paragraph>

      <Space orientation="vertical" size="middle" style={{ display: 'flex' }}>
        <Button type="primary" onClick={onEdit}>
          Редактировать
        </Button>

        {profile.isPending && <Spin />}
        {profile.isError && (
          <Typography.Paragraph type="danger">
            {messageOfError(profile.error, 'Не удалось загрузить профиль.')}
          </Typography.Paragraph>
        )}
        {profile.data !== undefined && <ProfileCard profile={profile.data} />}
      </Space>
    </>
  );
}
