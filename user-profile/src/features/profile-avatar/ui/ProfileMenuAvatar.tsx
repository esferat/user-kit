import { ProfileAvatar, useProfileQuery } from '@entities/user';

export interface ProfileMenuAvatarProps {
  /**
   * Имя для плейсхолдера из букв, пока профиль грузится или если его не
   * прочитать: хост передаёт имя из своей сессии, аватар не становится пустым.
   */
  name?: string;
  /** Размер в пикселях; по умолчанию — размер аватара в шапке. */
  size?: number;
}

/**
 * Аватар для шапки хоста: миниатюра профиля, прочитанная через BFF.
 *
 * Компонент грузится через отдельный expose `./ProfileAvatar`, поэтому в
 * меню попадает та же версия аватара, что и на страницах микрофронтенда,
 * и обновляется вместе с загрузкой нового изображения.
 */
export function ProfileMenuAvatar({ name = '', size = 24 }: ProfileMenuAvatarProps) {
  const profile = useProfileQuery();
  const current = profile.data;

  return (
    <ProfileAvatar
      size={size}
      displayName={current?.displayName ?? name}
      avatarUrl={current?.avatarThumbnailUrl ?? null}
    />
  );
}
