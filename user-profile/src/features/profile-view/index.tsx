import { AppProviders } from '@shared/ui';

import { ProfileView, type ProfileViewProps } from './ui/ProfileView';

export { ProfileView };
export type { ProfileViewProps };

/**
 * Точка входа микрофронтенда: именно этот модуль публикуется в
 * `module-federation.config.ts` под именем `./ProfilePage`.
 *
 * Компонент самодостаточен — он привозит свои провайдеры (QueryClient, antd),
 * потому что рендерится внутри чужого приложения и не может рассчитывать на
 * контексты хоста.
 */
export default function ProfilePageEntry(props: ProfileViewProps) {
  return (
    <AppProviders>
      <ProfileView {...props} />
    </AppProviders>
  );
}
