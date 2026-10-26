import { Helmet } from '@modern-js/runtime/head';
import { Link } from '@modern-js/runtime/router';
import { Button, Space, Spin, Typography } from 'antd';

import { ProfileCard, useProfileQuery } from '@entities/user';
import { messageOfError } from '@shared/lib';

/** Домашняя страница сервиса: карточка профиля и переход к правке. */
export default function Index() {
  const profile = useProfileQuery();

  return (
    <>
      <Helmet>
        <title>Личный кабинет — user-profile</title>
      </Helmet>
      <Typography.Title level={2} style={{ marginTop: 0 }}>
        Личный кабинет
      </Typography.Title>
      <Typography.Paragraph type="secondary">
        Микрофронтенд user-profile. Профиль читается через собственный BFF, сессия живёт в
        httpOnly cookie бэкенда.
      </Typography.Paragraph>

      <Space orientation="vertical" size="middle" style={{ display: 'flex' }}>
        <Link to="/profile/edit">
          <Button type="primary">Редактировать</Button>
        </Link>

        {profile.isPending && <Spin />}
        {profile.isError && (
          <Typography.Paragraph type="danger">
            {messageOfError(profile.error, 'Не удалось прочитать профиль.')}
          </Typography.Paragraph>
        )}
        {profile.data !== undefined && <ProfileCard profile={profile.data} />}
      </Space>
    </>
  );
}
