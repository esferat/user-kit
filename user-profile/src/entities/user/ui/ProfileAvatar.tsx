import { Avatar } from 'antd';

import { initialsOf } from '@shared/lib';

export interface ProfileAvatarProps {
  displayName: string;
  /** Полный аватар; `null`, пока аватар не загружен. */
  avatarUrl?: string | null;
  size?: number;
}

/** Аватар профиля с плейсхолдером из букв имени. */
export function ProfileAvatar({ displayName, avatarUrl, size = 80 }: ProfileAvatarProps) {
  return (
    <Avatar size={size} src={avatarUrl ?? undefined}>
      {initialsOf(displayName)}
    </Avatar>
  );
}
