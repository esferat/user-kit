import { AppProviders } from '@shared/ui';

import { ProfileMenuAvatar, type ProfileMenuAvatarProps } from './ui/ProfileMenuAvatar';

export { ProfileMenuAvatar };
export type { ProfileMenuAvatarProps };

/**
 * Точка входа микрофронтенда: именно этот модуль публикуется в
 * `module-federation.config.ts` под именем `./ProfileAvatar`.
 *
 * Назначение — аватар в шапке хоста (frontend-main). Как и другие exposes,
 * компонент привозит свои провайдеры: в чужом приложении нет ни своего
 * QueryClient, ни контекста antd.
 */
export default function ProfileAvatarEntry(props: ProfileMenuAvatarProps) {
  return (
    <AppProviders>
      <ProfileMenuAvatar {...props} />
    </AppProviders>
  );
}
