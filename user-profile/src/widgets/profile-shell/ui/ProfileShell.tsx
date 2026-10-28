import { Typography } from 'antd';

import { ProfileEditForm, type ProfileEditFormProps } from '@features/profile-edit';

/**
 * Оболочка экрана правки: заголовок, пояснение и сама форма. Используется
 * локальным роутом этого сервиса; во frontend-main форма вставляется напрямую
 * через Module Federation, без этой оболочки.
 */
export function ProfileShell(props: ProfileEditFormProps) {
  return (
    <>
      <Typography.Title level={2} style={{ marginTop: 0 }}>
        Правка профиля
      </Typography.Title>
      <Typography.Paragraph type="secondary">
        Данные уходят в бэкенд через BFF этого сервиса: браузер видит только свой Origin, токенов в
        странице нет.
      </Typography.Paragraph>
      <ProfileEditForm {...props} />
    </>
  );
}
